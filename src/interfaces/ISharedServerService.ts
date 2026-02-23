import * as vscode from "vscode";

import { ServerInfo } from "../models/ServerInfo.js";

export interface ISharedServerService {
    readonly onRegistryChange: vscode.Event<void>;
    shareServer(): Promise<void>;
    joinSharedServer(): Promise<void>;
    joinServerById(id: string): Promise<void>;
    stopServer(id?: string): void;
    getSharedServers(): ServerInfo[];
    removeServersByOwner(owner: string): void;
    dispose(): void;
}
