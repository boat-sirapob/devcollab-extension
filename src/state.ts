import * as vscode from "vscode";

import { injectable, inject } from "tsyringe";
import { IFollowService } from "./interfaces/IFollowService.js";
import { SessionParticipant } from "../shared/models/SessionParticipant.js";
import { ISessionService } from "./interfaces/ISessionService.js";

@injectable()
export class ExtensionState {
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    disposables: vscode.Disposable[];

    constructor(
        @inject("IFollowService") private followService: IFollowService,
        @inject("ISessionService") private sessionService: ISessionService
    ) {
        this.disposables = [];

        this.sessionService.onDidChange(() => {
            this._onDidChange.fire();
        });
    }

    dispose() {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables = [];

        this.sessionService.dispose();
    }

    get session() {
        return this.sessionService.session;
    }

    get loading() {
        return this.sessionService.loading;
    }

    cleanupOldTempDirs() {
        this.sessionService.cleanupOldTempDirs();
    }

    async restorePendingSession() {
        await this.sessionService.restorePendingSession();
    }

    async copyRoomCode(roomCode?: string) {
        await this.sessionService.copyRoomCode(roomCode);
    }

    toggleFollow(p: SessionParticipant) {
        if (!this.session) {
            vscode.window.showErrorMessage("No active collaboration session.");
            return;
        }

        this.followService.toggleFollow(p);
    }

    async test() {
        console.log("test");
    }

    async hostSession() {
        await this.sessionService.hostSession();
    }

    async joinSession() {
        await this.sessionService.joinSession();
    }

    async endSession() {
        await this.sessionService.endSession();
    }

    async closeSession() {
        await this.sessionService.closeSession();
    }

    async disconnectSession() {
        await this.sessionService.disconnectSession();
    }

    handleUndo() {
        this.sessionService.handleUndo();
    }

    handleRedo() {
        this.sessionService.handleRedo();
    }
}
