import * as vscode from "vscode";

import { AwarenessState } from "../../models/AwarenessState.js";
import { ExtensionState } from "../../state.js";
import { inject, injectable } from "tsyringe";
import { ISessionService } from "../../interfaces/ISessionService.js";
import { Session } from "../../session/Session.js";
import { IAwarenessService } from "../../interfaces/IAwarenessService.js";
import { SessionInfoViewModel } from "./SessionInfoViewModel.js";

type Node = {
    label: string;
    description?: string;
    children?: Node[];
    command?: { command: string; title: string; arguments?: any[] };
};

@injectable()
export class SessionInfoViewProvider implements vscode.TreeDataProvider<Node> {
    public readonly viewType = "devcollab.main";

    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private viewModel?: SessionInfoViewModel;

    constructor(
        @inject(ExtensionState) private state: ExtensionState,
        @inject("ISessionService") private sessionService: ISessionService
    ) {
        state.onDidChange(() => {
            this._onDidChangeTreeData.fire();
        });

        this.sessionService.onBeginSession(this.onSessionStarted)
        this.sessionService.onEndSession(this.onSessionEnded)
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    onSessionStarted = () => {
        this.viewModel = this.sessionService.get<SessionInfoViewModel>("SessionInfoViewModel");
        this.refresh();
    }

    onSessionEnded = () => {
        this.viewModel = undefined;
        this.refresh();
    }

    getTreeItem(node: Node): vscode.TreeItem {
        const item = new vscode.TreeItem(
            node.label,
            node.children
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None
        );
        item.description = node.description;
        if (node.command) {
            // assign command to allow clicking the item
            item.command = node.command as any;
        }
        return item;
    }

    getChildren(node?: Node): Node[] {
        if (node) {
            return node.children ?? [];
        }

        if (this.state.loading) {
            return [
                {
                    label: "Loading...",
                },
            ];
        }

        // no session
        if (!this.viewModel) {
            return [];
        }

        // in session
        return this.viewModel.getChildrenWithSession();
    }
}
