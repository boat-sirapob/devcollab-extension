import * as Y from "yjs";
import * as vscode from "vscode";

export class GuestTerminalPty implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    private closeEmitter = new vscode.EventEmitter<number | void>();
    readonly onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    readonly onDidClose: vscode.Event<number | void> = this.closeEmitter.event;

    private outputObserver:
        | ((event: Y.YArrayEvent<string>) => void)
        | undefined;
    private metaObserver:
        | ((event: Y.YMapEvent<unknown>) => void)
        | undefined;

    constructor(
        private outputArray: Y.Array<string>,
        private inputArray: Y.Array<string>,
        private metaMap: Y.Map<unknown>,
        private ownerName: string = "owner"
    ) { }

    open(_initialDimensions: vscode.TerminalDimensions | undefined): void {
        // replay the full output history so the guest catches up
        for (let i = 0; i < this.outputArray.length; i++) {
            this.writeEmitter.fire(this.outputArray.get(i));
        }

        this.outputObserver = (event: Y.YArrayEvent<string>) => {
            for (const delta of event.changes.delta) {
                if ("insert" in delta) {
                    for (const chunk of delta.insert as string[]) {
                        this.writeEmitter.fire(chunk);
                    }
                }
            }
        };
        this.outputArray.observe(this.outputObserver);

        // detect when the owner closes the terminal
        this.metaObserver = (event: Y.YMapEvent<unknown>) => {
            if (event.keysChanged.has("active")) {
                const active = this.metaMap.get("active");
                if (!active) {
                    this.writeEmitter.fire(
                        `\r\n\x1b[33m[${this.ownerName} closed the shared terminal]\x1b[0m\r\n`
                    );
                    this.closeEmitter.fire(0);
                }
            }
        };
        this.metaMap.observe(this.metaObserver);
    }

    handleInput(data: string): void {
        this.inputArray.push([data]);
    }

    setDimensions(_dimensions: vscode.TerminalDimensions): void {
        // todo: handle resizing
    }

    close(): void {
        if (this.outputObserver) {
            this.outputArray.unobserve(this.outputObserver);
        }
        if (this.metaObserver) {
            this.metaMap.unobserve(this.metaObserver);
        }
    }
}
