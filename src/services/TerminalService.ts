import * as Y from "yjs";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import { inject, injectable } from "tsyringe";

import { ITerminalService } from "../interfaces/ITerminalService.js";
import { Session } from "../session/Session.js";
import { SessionInfo } from "../session/SessionInfo.js";
import { HostTerminalPty } from "../terminal/HostTerminalPty.js";
import { GuestTerminalPty } from "../terminal/GuestTerminalPty.js";
import { TerminalInfo } from "../models/TerminalInfo.js";
import { TerminalProfileConfig } from "../terminal/TerminalProfileConfig.js";
import { ShellProfile } from "../terminal/ShellProfile.js";

/**
 * Yjs document keys used (per terminal with id `<id>`):
 *   "terminal:<id>:output"   – Y.Array<string>  owner -> joiners  (pty stdout)
 *   "terminal:<id>:input"    – Y.Array<string>  joiners -> owner  (keystrokes)
 *   "terminal:<id>:meta"     – Y.Map            metadata (active, shell, owner)
 *   "terminal:registry"      – Y.Map            id -> TerminalRegistryEntry
 */
@injectable()
export class TerminalService implements ITerminalService {
    private terminalMap = new Map<string, vscode.Terminal>();
    private registry: Y.Map<TerminalInfo>;
    private terminalCloseListener: vscode.Disposable;

    private _onRegistryChange = new vscode.EventEmitter<void>();
    readonly onRegistryChange: vscode.Event<void> = this._onRegistryChange.event;

    constructor(
        @inject("Session") private session: Session,
        @inject("SessionInfo") private sessionInfo: SessionInfo
    ) {
        this.registry = this.session.doc.getMap<TerminalInfo>("terminal:registry");

        this.registry.observe(() => {
            this._onRegistryChange.fire();
        });

        this.terminalCloseListener = vscode.window.onDidCloseTerminal(this.handleTerminalClose);
    }

    handleTerminalClose = (closedTerminal: vscode.Terminal) => {
        for (const [id, terminal] of this.terminalMap.entries()) {
            if (terminal === closedTerminal) {
                this.terminalMap.delete(id);
                break;
            }
        }
    }

    getSharedTerminals(): TerminalInfo[] {
        const result: TerminalInfo[] = [];
        this.registry.forEach((entry, id) => {
            result.push({ ...entry, id });
        });
        return result;
    }

    private getOutputArray(id: string): Y.Array<string> {
        return this.session.doc.getArray<string>(`terminal:${id}:output`);
    }

    private getInputArray(id: string): Y.Array<string> {
        return this.session.doc.getArray<string>(`terminal:${id}:input`);
    }

    private getMetaMap(id: string): Y.Map<unknown> {
        return this.session.doc.getMap(`terminal:${id}:meta`);
    }

    async shareTerminal(): Promise<void> {
        const shellProfile = await this.pickShellProfile();
        if (!shellProfile) {
            return; // user cancelled
        }

        const id = this.generateTerminalId();
        const outputArray = this.getOutputArray(id);
        const inputArray = this.getInputArray(id);
        const metaMap = this.getMetaMap(id);

        const hostPty = new HostTerminalPty(
            this.session.rootPath,
            shellProfile,
            outputArray,
            inputArray,
            metaMap
        );

        const shellName = path.basename(shellProfile.path, path.extname(shellProfile.path));
        const terminalName = `DevCollab: ${shellName} (${this.sessionInfo.username})`;

        const terminal = vscode.window.createTerminal({
            name: terminalName,
            pty: hostPty,
        });

        this.registry.set(id, {
            id,
            owner: this.sessionInfo.username,
            shell: shellName,
            active: true,
        });

        // keep registry in sync when the terminal closes
        metaMap.observe((event: Y.YMapEvent<unknown>) => {
            if (event.keysChanged.has("active")) {
                const active = metaMap.get("active");
                if (!active) {
                    const entry = this.registry.get(id);
                    if (entry) {
                        this.registry.set(id, { ...entry, active: false });
                    }
                }
            }
        });

        this.terminalMap.set(id, terminal);
        terminal.show();

        vscode.window.showInformationMessage(
            "Terminal is now shared with collaborators."
        );
    }

    async joinSharedTerminal(): Promise<void> {
        // build a list of all active terminals from the registry
        const activeTerminals: { id: string; entry: TerminalInfo }[] = [];

        this.registry.forEach((entry, id) => {
            if (entry.active && entry.owner !== this.sessionInfo.username) {
                activeTerminals.push({ id, entry });
            }
        });

        if (activeTerminals.length === 0) {
            vscode.window.showErrorMessage(
                "No shared terminals are available to join."
            );
            return;
        }

        interface TerminalPickItem extends vscode.QuickPickItem {
            terminalId: string;
        }

        const items: TerminalPickItem[] = activeTerminals.map(({ id, entry }) => ({
            label: `${entry.owner}'s terminal`,
            description: entry.shell,
            detail: `Terminal ID: ${id}`,
            terminalId: id,
        }));

        let picked: TerminalPickItem | undefined = await vscode.window.showQuickPick(items, {
            placeHolder: "Select a shared terminal to join",
        });

        if (!picked) {
            return; // user cancelled
        }

        const { terminalId } = picked;
        const entry = this.registry.get(terminalId)!;

        const guestPty = new GuestTerminalPty(
            this.getOutputArray(terminalId),
            this.getInputArray(terminalId),
            this.getMetaMap(terminalId),
            entry.owner
        );

        const terminal = vscode.window.createTerminal({
            name: `DevCollab: ${entry.shell} (${entry.owner}) [joined]`,
            pty: guestPty,
        });

        this.terminalMap.set(terminalId, terminal);
        terminal.show();

        vscode.window.showInformationMessage(
            `Joined ${entry.owner}'s shared terminal.`
        );
    }

    joinTerminalById(id: string): void {
        const entry = this.registry.get(id);
        if (!entry || !entry.active) {
            vscode.window.showErrorMessage("That shared terminal is no longer available.");
            return;
        }

        // if we already have a terminal open for this ID, just focus it
        const existing = this.terminalMap.get(id);
        if (existing) {
            existing.show();
            return;
        }

        const guestPty = new GuestTerminalPty(
            this.getOutputArray(id),
            this.getInputArray(id),
            this.getMetaMap(id),
            entry.owner
        );

        const terminal = vscode.window.createTerminal({
            name: `DevCollab: ${entry.shell} (${entry.owner}) [joined]`,
            pty: guestPty,
        });

        this.terminalMap.set(id, terminal);
        terminal.show();
    }

    async stopSharingTerminal(id?: string): Promise<void> {
        if (!id) {
            // prompt user to pick from their own active shared terminals
            const ownTerminals: { id: string; entry: TerminalInfo }[] = [];

            this.registry.forEach((entry, id) => {
                if (entry.active && entry.owner === this.sessionInfo.username) {
                    ownTerminals.push({ id, entry });
                }
            });
            if (ownTerminals.length === 0) {
                vscode.window.showErrorMessage(
                    "You have no active shared terminals to stop sharing."
                );
                return;
            }
            interface TerminalPickItem extends vscode.QuickPickItem {
                terminalId: string;
            }
            const items: TerminalPickItem[] = ownTerminals.map(({ id, entry }) => ({
                label: entry.shell,
                description: `Terminal ID: ${id}`,
                terminalId: id,
            }));
            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: "Select a shared terminal to stop sharing",
            });
            if (!picked) {
                return; // user cancelled
            }
            id = picked.terminalId;
        }

        const entry = this.registry.get(id);

        if (entry) {
            // stop the terminal
            const terminal = this.terminalMap.get(id);
            if (terminal) {
                terminal.dispose();
                this.terminalMap.delete(id);
            }

            // update registry
            this.registry.set(id, { ...entry, active: false });
            vscode.window.showInformationMessage("Stopped sharing terminal.");
        }
    }

    private generateTerminalId(): string {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    private async pickShellProfile(): Promise<ShellProfile | undefined> {
        const platform =
            os.platform() === "win32"
                ? "windows"
                : os.platform() === "darwin"
                    ? "osx"
                    : "linux";

        const profilesConfig =
            vscode.workspace
                .getConfiguration("terminal.integrated.profiles")
                .get<Record<string, TerminalProfileConfig>>(platform) ?? {};

        interface ProfileItem extends vscode.QuickPickItem {
            profile: ShellProfile;
        }

        const items: ProfileItem[] = [];

        for (const [name, cfg] of Object.entries(profilesConfig)) {
            if (!cfg) {
                continue;
            }

            const resolved = this.resolveProfileConfig(name, cfg);
            if (!resolved) {
                continue;
            }

            items.push({
                label: name,
                description: resolved.path,
                profile: resolved,
            });
        }

        const defaultShell =
            vscode.env.shell ||
            (os.platform() === "win32" ? "powershell.exe" : "/bin/bash");

        items.push({
            label: "Default",
            description: defaultShell,
            profile: { path: defaultShell },
        });

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: "Select a shell profile for the shared terminal",
        });

        return picked?.profile;
    }

    private resolveProfileConfig(
        name: string,
        cfg: TerminalProfileConfig
    ): ShellProfile | undefined {
        if (cfg.source) {
            return this.resolveSourceProfile(cfg.source, cfg.args);
        }

        if (!cfg.path) {
            return undefined;
        }

        const candidates = Array.isArray(cfg.path) ? cfg.path : [cfg.path];

        for (const raw of candidates) {
            const resolved = this.resolveShellPath(raw);
            if (resolved && fs.existsSync(resolved)) {
                return {
                    path: resolved,
                    args: cfg.args,
                    useConpty: this.isMsysShell(resolved) ? false : undefined,
                };
            }
        }

        return undefined;
    }

    private resolveShellPath(raw: string): string | undefined {
        if (!raw) {
            return undefined;
        }

        // replace ${env:VAR} with the actual environment variable value
        const expanded = raw.replace(
            /\$\{env:(\w+)\}/gi,
            (_match, varName: string) => process.env[varName] ?? ""
        );

        if (!expanded) {
            return undefined;
        }

        return path.normalize(expanded);
    }

    private resolveSourceProfile(
        source: string,
        args?: string[]
    ): ShellProfile | undefined {
        const isWin = os.platform() === "win32";
        const windir = process.env.windir ?? "C:\\Windows";
        const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files";

        const knownSources: Record<string, string[]> = isWin
            ? {
                PowerShell: [
                    path.join(
                        programFiles,
                        "PowerShell",
                        "7",
                        "pwsh.exe"
                    ),
                    path.join(
                        windir,
                        "System32",
                        "WindowsPowerShell",
                        "v1.0",
                        "powershell.exe"
                    ),
                ],
                "Git Bash": [
                    path.join(programFiles, "Git", "bin", "bash.exe"),
                    path.join(
                        programFiles,
                        "Git",
                        "usr",
                        "bin",
                        "bash.exe"
                    ),
                    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
                ],
                "WSL": [
                    path.join(windir, "System32", "wsl.exe"),
                ],
                "Command Prompt": [
                    path.join(windir, "System32", "cmd.exe"),
                ],
            }
            : {
                bash: ["/bin/bash", "/usr/bin/bash"],
                zsh: ["/bin/zsh", "/usr/bin/zsh"],
                fish: ["/usr/bin/fish", "/usr/local/bin/fish"],
                tmux: ["/usr/bin/tmux"],
                pwsh: ["/usr/local/bin/pwsh", "/usr/bin/pwsh"],
            };

        const candidates = knownSources[source];
        if (!candidates) {
            return undefined;
        }

        const msysSources = new Set(["Git Bash"]);

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return {
                    path: candidate,
                    args,
                    useConpty: msysSources.has(source) ? false : undefined,
                };
            }
        }

        return undefined;
    }

    private isMsysShell(shellPath: string): boolean {
        const lower = shellPath.toLowerCase();
        return (
            lower.includes("git") ||
            lower.includes("msys") ||
            lower.includes("cygwin") ||
            lower.includes("mingw")
        );
    }

    dispose(): void {
        this.terminalCloseListener.dispose();
        for (const terminal of this.terminalMap.values()) {
            terminal.dispose();
        }
        this.terminalMap.clear();
    }
}
