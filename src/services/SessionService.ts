import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import { absoluteToRelative, getWorkspaceType } from "../helpers/Utilities.js";

import { ISessionService } from "../interfaces/ISessionService.js";
import { Session } from "../session/Session.js";
import { WorkspaceType } from "../enums/WorkspaceType.js";
import { injectable, inject } from "tsyringe";
import { IPersistenceService } from "../interfaces/IPersistenceService.js";

@injectable()
export class SessionService implements ISessionService {
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;
    private _onInitialize = new vscode.EventEmitter<void>();
    readonly onBeginSession = this._onInitialize.event;

    loading: boolean;
    session: Session | null;
    tempDir: string | null;

    constructor(
        @inject("ExtensionContext") private context: vscode.ExtensionContext,
        @inject("IPersistenceService")
        private persistenceService: IPersistenceService
    ) {
        this.loading = false;
        this.session = null;
        this.tempDir = null;
    }

    dispose(): void {
        this.session?.dispose();
        this.session = null;
        this._onDidChange.fire();
    }

    getSession(): Session | null {
        return this.session;
    }

    cleanupOldTempDirs() {
        try {
            const tempDirBase = path.join(os.tmpdir(), "devcollab-sessions");
            if (!fs.existsSync(tempDirBase)) {
                return;
            }

            const entries = fs.readdirSync(tempDirBase, {
                withFileTypes: true,
            });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const dirPath = path.join(tempDirBase, entry.name);
                    if (dirPath === this.tempDir) {
                        continue;
                    }

                    try {
                        fs.rmSync(dirPath, { recursive: true, force: true });
                    } catch (err) {
                        // ignore - directory might still be in use
                    }
                }
            }
        } catch (err) {
            // ignore
        }
    }

    async restorePendingSession() {
        let pendingSession = this.persistenceService.getPendingSessionState();

        if (!pendingSession) {
            return;
        }

        if (!pendingSession.fromJoin) {
            // todo: dialogue choose whether to rejoin if not from join session
        }

        pendingSession.fromJoin = false;
        await this.persistenceService.setPendingSessionState(pendingSession);

        this.setLoading(true);
        this.tempDir = pendingSession.tempDir;

        try {
            this.session = await Session.joinSession(
                pendingSession.roomCode,
                pendingSession.tempDir,
                pendingSession.username,
                this._onDidChange
            );

            this.session.onHostDisconnect = async () => {
                await this.disconnectSession();
            };

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: "Connecting to collaboration server",
                    cancellable: false,
                },
                async () => {
                    try {
                        await this.session!.waitForConnection(5000);
                        const hostFound = await this.session!.waitForHost(2000);
                        if (!hostFound) {
                            vscode.window.showErrorMessage(
                                `Unable to reconnect to session ${pendingSession.roomCode}`
                            );
                            await this.closeLocalSession();
                            return;
                        }

                        this._onInitialize.fire();

                        vscode.window.showInformationMessage(
                            "Connected to collaboration session"
                        );
                    } catch (err) {
                        vscode.window.showErrorMessage(
                            "Unable to reconnect to collaboration server"
                        );
                        await this.closeLocalSession();
                    } finally {
                        this.setLoading(false);
                    }
                }
            );
        } catch (err) {
            console.error("Failed to restore session:", err);
            await this.closeLocalSession();
            this.setLoading(false);
        }
    }

    private setLoading(val: boolean) {
        this.loading = val;
        this._onDidChange.fire();
    }

    async copyRoomCode(roomCode?: string) {
        const code = roomCode ?? this.session?.roomCode;
        if (!code) {
            vscode.window.showErrorMessage(
                "No active collaboration session to copy code from."
            );
            return;
        }
        await vscode.env.clipboard.writeText(code);
        vscode.window.showInformationMessage(
            `Copied room code ${code} to clipboard!`
        );
    }

    private async inputUsername(): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            title: "Display name",
            value: this.persistenceService.getSavedUsername() ?? "",
            placeHolder:
                "Enter your display name for this session (empty to cancel)",
        });
    }

    async closeLocalSession() {
        if (this.session) {
            this.session.provider.disconnect();
            this.session.dispose();
        }

        await this.persistenceService.setPendingSessionState(undefined);
        this.session = null;
        this._onDidChange.fire();
    }

    // https://stackblitz.com/edit/y-quill-doc-list?file=index.ts
    async hostSession() {
        if (this.session !== null) {
            vscode.window.showErrorMessage(
                "You are already in a collaboration session."
            );
            return;
        }

        this.setLoading(true);

        let folders = vscode.workspace.workspaceFolders;
        let editor = vscode.window.activeTextEditor;
        let workspaceType = getWorkspaceType();

        let targetRootPath: string | undefined;
        let singleFilePath: string | undefined;
        let startedForFileName: string | undefined;

        switch (workspaceType) {
            case WorkspaceType.Empty:
                // todo: open file browser instead?
                vscode.window.showInformationMessage(
                    "Open a file or folder to start collaborating!"
                );
                this.setLoading(false);
                return;
            case WorkspaceType.SingleFile: {
                if (!editor) {
                    vscode.window.showInformationMessage(
                        "Open a file to start collaborating!"
                    );
                    this.setLoading(false);
                    return;
                }

                singleFilePath = editor.document.uri.fsPath;
                targetRootPath = path.dirname(singleFilePath);
                startedForFileName = path.basename(singleFilePath);

                break;
            }
            case WorkspaceType.SingleRootFolder:
                targetRootPath = folders![0].uri.fsPath;
                break;
            case WorkspaceType.MultiRootFolder:
                vscode.window.showInformationMessage(
                    "Sorry, multi-rooted workspaces are not supported. Please open a file or folder to start collaborating."
                );
                this.setLoading(false);
                return;
        }

        let username = await this.inputUsername();
        if (!username) {
            vscode.window.showInformationMessage(
                "Cancelled hosting collaboration session."
            );
            this.setLoading(false);
            return;
        }
        await this.persistenceService.setSavedUsername(username);

        this.session = await Session.hostSession(
            targetRootPath!,
            username,
            this._onDidChange,
            singleFilePath
        );

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Connecting to collaboration server",
                cancellable: false,
            },
            async () => {
                try {
                    await this.session!.waitForConnection(5000);
                } catch {
                    vscode.window.showErrorMessage(
                        "Unable to connect to collaboration server"
                    );
                    await this.closeLocalSession();
                } finally {
                    this.setLoading(false);
                }
            }
        );
        if (this.session === null) {
            return;
        }

        this._onInitialize.fire();

        const message = startedForFileName
            ? `Collaboration session started for file ${startedForFileName} with room code: ${this.session.roomCode}`
            : `Collaboration session started with room code: ${this.session.roomCode}`;

        vscode.window
            .showInformationMessage(message, "Copy code to clipboard")
            .then(async (copy) => {
                if (copy) {
                    this.copyRoomCode(this.session?.roomCode);
                }
            });
    }

    async joinSession() {
        if (this.session !== null) {
            vscode.window.showErrorMessage(
                "You are already in a collaboration session."
            );
            return;
        }

        this.setLoading(true);

        const roomCode = await vscode.window.showInputBox({
            prompt: "Enter the room code for the collaboration session you want to join",
            placeHolder: "Room Code",
        });
        if (!roomCode) {
            vscode.window.showInformationMessage(
                "Cancelled joining collaboration session."
            );
            this.setLoading(false);
            return;
        }

        let username = await this.inputUsername();
        if (!username) {
            vscode.window.showInformationMessage(
                "Cancelled joining collaboration session."
            );
            this.setLoading(false);
            return;
        }
        await this.persistenceService.setSavedUsername(username);

        const tempDirBase = path.join(os.tmpdir(), "devcollab-sessions");
        if (!fs.existsSync(tempDirBase)) {
            fs.mkdirSync(tempDirBase, { recursive: true });
        }

        this.tempDir = fs.mkdtempSync(path.join(tempDirBase, `session-`));
        const targetUri = vscode.Uri.file(this.tempDir);

        // extension state resets on opening a folder
        // this retains the state to allow connecting to the session in the temp folder
        if (this.context) {
            await this.persistenceService.setPendingSessionState({
                roomCode: roomCode,
                username: username,
                tempDir: this.tempDir,
                fromJoin: true,
            });
        }

        await vscode.commands.executeCommand(
            "vscode.openFolder",
            targetUri,
            false // don't open in new window
        );
    }

    async endSession() {
        if (this.session === null) {
            vscode.window.showErrorMessage(
                "You are not in a collaboration session."
            );
            return;
        }
        if (this.session.participantType === "Host") {
            await this.closeSession();
        } else {
            await this.disconnectSession();
        }
    }

    async closeSession() {
        vscode.window.showInformationMessage(
            "The collaboration session has been ended."
        );
        await this.closeLocalSession();
    }

    async disconnectSession() {
        vscode.window.showInformationMessage(
            "You have disconnected from the collaboration session."
        );
        await this.closeLocalSession();
        await vscode.commands.executeCommand("workbench.action.closeFolder");
    }

    handleUndo() {
        const editor = vscode.window.activeTextEditor;

        if (!this.session || !editor) {
            vscode.commands.executeCommand("undo");
            return;
        }

        const relPath = absoluteToRelative(
            editor.document.uri.fsPath.toString(),
            this.session.rootPath
        );
        const binding = this.session.bindings.get(relPath);

        if (binding?.yUndoManager) {
            binding.yUndoManager.undo();
        } else {
            vscode.commands.executeCommand("undo");
        }
    }

    handleRedo() {
        const editor = vscode.window.activeTextEditor;

        if (!this.session || !editor) {
            vscode.commands.executeCommand("redo");
            return;
        }

        const relPath = absoluteToRelative(
            editor.document.uri.fsPath.toString(),
            this.session.rootPath
        );
        const binding = this.session.bindings.get(relPath);

        if (binding?.yUndoManager) {
            binding.yUndoManager.redo();
        } else {
            void vscode.commands.executeCommand("redo");
        }
    }
}
