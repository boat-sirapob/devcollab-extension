import * as vscode from "vscode";

import { TerminalInfo } from "../models/TerminalInfo.js";

export interface ITerminalService {
    readonly onRegistryChange: vscode.Event<void>;
    shareTerminal(): Promise<void>;
    joinSharedTerminal(): Promise<void>;
    joinTerminalById(id: string): void;
    stopSharingTerminal(id?: string): Promise<void>;
    getSharedTerminals(): TerminalInfo[];
    removeTerminalsByOwner(owner: string): void;
    dispose(): void;
}
