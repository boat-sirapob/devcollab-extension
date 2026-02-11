import * as vscode from "vscode";

import { inject, injectable } from "tsyringe";
import { ISessionService } from "../../interfaces/ISessionService.js";
import { ISharedServerService } from "../../interfaces/ISharedServerService.js";
import { SharedServersViewModel } from "./SharedServersViewModel.js";
import { ServerInfo } from "../../models/ServerInfo.js";
import { SessionInfo } from "../../session/SessionInfo.js";

@injectable()
export class SharedServersViewProvider
    implements vscode.TreeDataProvider<ServerInfo> {
    public readonly viewType = "devcollab.servers";

    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private viewModel?: SharedServersViewModel;
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
        this.viewModel = this.sessionService.get<SharedServersViewModel>(
            "SharedServersViewModel"
        );
        this.sessionInfo = this.sessionService.get<SessionInfo>("SessionInfo");

        const serverService =
            this.sessionService.get<ISharedServerService>("ISharedServerService");
        this.registryDisposable = serverService.onRegistryChange(() =>
            this.refresh()
        );

        this.refresh();
    };

    onSessionEnded = () => {
        this.viewModel = undefined;
        this.sessionInfo = undefined;
        this.registryDisposable?.dispose();
        this.registryDisposable = undefined;
        this.refresh();
    };

    getTreeItem(node: ServerInfo): vscode.TreeItem {
        const isOwn = node.owner === this.sessionInfo?.username;

        const label = `${node.owner}'s server`;

        const item = new vscode.TreeItem(
            label,
            vscode.TreeItemCollapsibleState.None
        );

        item.description = node.label;
        item.iconPath = new vscode.ThemeIcon("globe");

        if (isOwn) {
            item.tooltip = `Your shared server — ${node.label} (port ${node.port})`;
            item.contextValue = "ownServer";
        } else {
            item.tooltip = `Click to connect to ${node.owner}'s server — ${node.label}`;
            item.command = {
                command: "devcollab.joinServerById",
                title: "Connect to Server",
                arguments: [node.id],
            };
        }

        return item;
    }

    getChildren(_node?: ServerInfo): ServerInfo[] {
        if (!this.viewModel) {
            return [];
        }

        return this.viewModel.getActiveServers();
    }
}
