import * as vscode from "vscode";

import { AwarenessState } from "../../models/AwarenessState.js";
import { ExtensionState } from "../../state.js";

type Node = {
    label: string;
    description?: string;
    children?: Node[];
    command?: { command: string; title: string; arguments?: any[] };
};

export class SessionInfoSidebarProvider implements vscode.TreeDataProvider<Node> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private state: ExtensionState) {
        state.onDidChange(() => {
            this._onDidChangeTreeData.fire();
        });
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

        if (this.state.session === null) {
            return [];
        }

        return [
            {
                label: "Session Info",
                children: [
                    {
                        label: "Room Code",
                        description: this.state.session.roomCode,
                        command: {
                            command: "devcollab.copyRoomCode",
                            title: "Copy room code",
                            arguments: [this.state.session.roomCode],
                        },
                    },
                ],
            },
            {
                label: "Participants",
                children: this.state.session.participants.map((p) => {
                    const allStates = this.state.session?.awareness.getStates();
                    const participantState = allStates?.get(p.clientId) as
                        | AwarenessState
                        | undefined;
                    const currentFile = participantState?.cursor?.uri;

                    const statusLabel =
                        p.clientId === this.state.session?.awareness.clientID
                            ? "You" + (p.type === "Host" ? " (Host)" : "")
                            : p.type === "Host"
                              ? "Host"
                              : undefined;

                    const description = currentFile
                        ? statusLabel
                            ? `${statusLabel} - ${currentFile}`
                            : currentFile
                        : statusLabel;

                    return {
                        label: p.displayName,
                        description: description,
                        command: {
                            command: "devcollab.toggleFollow",
                            title: `Follow ${p.displayName}`,
                            arguments: [p],
                        },
                    };
                }),
            },
        ];
    }
}
