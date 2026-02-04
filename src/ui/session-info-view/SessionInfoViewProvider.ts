import * as vscode from "vscode";

import { AwarenessState } from "../../models/AwarenessState.js";
import { ExtensionState } from "../../state.js";
import { container, inject } from "tsyringe";
import { ISessionService } from "../../interfaces/ISessionService.js";
import { Session } from "../../session/Session.js";

type Node = {
    label: string;
    description?: string;
    children?: Node[];
    command?: { command: string; title: string; arguments?: any[] };
};

export class SessionInfoViewProvider implements vscode.TreeDataProvider<Node> {
    public readonly viewType = "devcollab.main";

    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private state: ExtensionState,
        @inject("ISessionService") private sessionService: ISessionService
    ) {
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

        if (!this.sessionService.hasSession()) {
            return [];
        }

        const session = this.sessionService.get<Session>("Session");

        console.log("test");

        return [
            {
                label: "Session Info",
                children: [
                    {
                        label: "Room Code",
                        description: session.roomCode,
                        command: {
                            command: "devcollab.copyRoomCode",
                            title: "Copy room code",
                            arguments: [session.roomCode],
                        },
                    },
                ],
            },
            {
                label: "Participants",
                children: session.participants.map((p) => {
                    const allStates = session?.awareness.getStates();
                    const participantState = allStates?.get(p.clientId) as
                        | AwarenessState
                        | undefined;
                    const currentFile = participantState?.cursor?.uri;

                    const statusLabel =
                        p.clientId === session?.awareness.clientID
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
