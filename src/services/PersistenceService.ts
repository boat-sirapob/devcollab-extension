import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { IPersistenceService } from "../interfaces/IPersistenceService.js";
import { PendingSessionState } from "../models/PendingSessionState.js";

@injectable()
export class PersistenceService implements IPersistenceService {
    constructor(
        @inject("ExtensionContext") private context: vscode.ExtensionContext
    ) {}

    getPendingSessionState(): PendingSessionState | undefined {
        return this.context.globalState.get<PendingSessionState>(
            "pendingSession"
        );
    }

    async setPendingSessionState(
        state: PendingSessionState | undefined
    ): Promise<void> {
        await this.context.globalState.update("pendingSession", state);
    }

    getSavedUsername(): string | undefined {
        return this.context.globalState.get<string>("savedUsername");
    }

    async setSavedUsername(username: string | undefined): Promise<void> {
        await this.context.globalState.update("savedUsername", username);
    }
}
