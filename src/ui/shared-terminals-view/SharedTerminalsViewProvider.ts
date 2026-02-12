import * as vscode from "vscode";

import { inject, injectable } from "tsyringe";
import { ISessionService } from "../../interfaces/ISessionService.js";
import { ITerminalService } from "../../interfaces/ITerminalService.js";
import { SharedTerminalsViewModel } from "./SharedTerminalsViewModel.js";
import { TerminalInfo } from "../../models/TerminalInfo.js";
import { SessionInfo } from "../../session/SessionInfo.js";

@injectable()
export class SharedTerminalsViewProvider implements vscode.TreeDataProvider<TerminalInfo> {
    public readonly viewType = "devcollab.terminals";

    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private viewModel?: SharedTerminalsViewModel;
    private registryDisposable?: vscode.Disposable;
    private sessionInfo?: SessionInfo;

    constructor(
        @inject("ISessionService") private sessionService: ISessionService
    ) {
        this.sessionService.onBeginSession(this.onSessionStarted);
        this.sessionService.onEndSession(this.onSessionEnded);
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    onSessionStarted = () => {
        this.viewModel = this.sessionService.get<SharedTerminalsViewModel>("SharedTerminalsViewModel");
        this.sessionInfo = this.sessionService.get<SessionInfo>("SessionInfo");

        const terminalService = this.sessionService.get<ITerminalService>("ITerminalService");
        this.registryDisposable = terminalService.onRegistryChange(() => this.refresh());

        this.refresh();
    };

    onSessionEnded = () => {
        this.viewModel = undefined;
        this.sessionInfo = undefined;
        this.registryDisposable?.dispose();
        this.registryDisposable = undefined;
        this.refresh();
    };

    getTreeItem(node: TerminalInfo): vscode.TreeItem {
        const isOwn = node.owner === this.sessionInfo?.username;

        const label = `${node.owner}'s terminal`;

        const item = new vscode.TreeItem(
            label,
            vscode.TreeItemCollapsibleState.None
        );

        item.description = node.shell;
        item.iconPath = new vscode.ThemeIcon("terminal");

        if (isOwn) {
            item.tooltip = `Click to focus your ${node.shell} terminal`;
            item.contextValue = "ownTerminal";
        } else {
            item.tooltip = `Click to join ${node.owner}'s ${node.shell} terminal`;
        }

        item.command = {
            command: "devcollab.joinTerminalById",
            title: isOwn ? "Focus Terminal" : "Join Terminal",
            arguments: [node.id],
        };

        return item;
    }

    getChildren(_node?: TerminalInfo): TerminalInfo[] {
        if (!this.viewModel) {
            return [];
        }

        return this.viewModel.getChildrenWithSession();
    }
}
