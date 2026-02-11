import * as Y from "yjs";
import * as pty from "node-pty";
import * as vscode from "vscode";

import { ShellProfile } from "./ShellProfile.js";

export class HostTerminalPty implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    private closeEmitter = new vscode.EventEmitter<number | void>();
    readonly onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    readonly onDidClose: vscode.Event<number | void> = this.closeEmitter.event;

    private ptyProcess: pty.IPty | undefined;
    private inputObserver: ((event: Y.YArrayEvent<string>) => void) | undefined;

    constructor(
        private cwd: string,
        private shellProfile: ShellProfile,
        private outputArray: Y.Array<string>,
        private inputArray: Y.Array<string>,
        private metaMap: Y.Map<unknown>
    ) { }

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        this.ptyProcess = pty.spawn(
            this.shellProfile.path,
            this.shellProfile.args ?? [],
            {
                name: "xterm-256color",
                cols: initialDimensions?.columns ?? 80,
                rows: initialDimensions?.rows ?? 30,
                cwd: this.cwd,
                env: process.env as Record<string, string>,
                useConpty: this.shellProfile.useConpty,
            }
        );

        this.metaMap.set("active", true);
        this.metaMap.set("shell", this.shellProfile.path);

        this.ptyProcess.onData((data: string) => {
            this.writeEmitter.fire(data);
            this.outputArray.push([data]);
        });

        this.ptyProcess.onExit(({ exitCode }) => {
            this.metaMap.set("active", false);
            this.closeEmitter.fire(exitCode);
        });

        this.inputObserver = (event: Y.YArrayEvent<string>) => {
            for (const delta of event.changes.delta) {
                if ("insert" in delta) {
                    for (const chunk of delta.insert as string[]) {
                        this.ptyProcess?.write(chunk);
                    }
                }
            }
        };
        this.inputArray.observe(this.inputObserver);
    }

    handleInput(data: string): void {
        this.ptyProcess?.write(data);
    }

    setDimensions(dimensions: vscode.TerminalDimensions): void {
        this.ptyProcess?.resize(dimensions.columns, dimensions.rows);
    }

    close(): void {
        if (this.inputObserver) {
            this.inputArray.unobserve(this.inputObserver);
        }
        this.ptyProcess?.kill();
        this.metaMap.set("active", false);
    }
}
