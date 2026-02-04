import * as vscode from "vscode";

import { ExtensionState } from "../../state.js";
import { inject } from "tsyringe";
import { ISessionService } from "../../interfaces/ISessionService.js";
import { Session } from "../../session/Session.js";

export class StatusBarProvider {
    private statusBarItem: vscode.StatusBarItem;
    private state: ExtensionState;

    constructor(
        state: ExtensionState,
        @inject("ISessionService") private sessionService: ISessionService
    ) {
        this.state = state;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );

        this.state.onDidChange(() => {
            this.updateStatusBar();
        });

        this.updateStatusBar();
    }

    private updateStatusBar() {
        const hasSession = this.sessionService.hasSession();

        if (!hasSession) {
            this.statusBarItem.text = "$(circle-slash) No Session";
            this.statusBarItem.tooltip = "DevCollab - Not in a session";
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.command = undefined;
            return
        }

        const session = this.sessionService.get<Session>("Session");

        if (session.connected) {
            this.statusBarItem.text = `$(broadcast) Connected: ${session.roomCode}`;
            this.statusBarItem.tooltip = `DevCollab - Room: ${session.roomCode}\nClick to disconnect`;
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.command = "devcollab.endSession";
        } else {
            this.statusBarItem.text = "$(debug-disconnect) Disconnected";
            this.statusBarItem.tooltip = "DevCollab - Disconnected\nClick to end session";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
            this.statusBarItem.command = "devcollab.endSession";
        }
        this.statusBarItem.show();
    }

    getStatusBarItem(): vscode.StatusBarItem {
        return this.statusBarItem;
    }
}
