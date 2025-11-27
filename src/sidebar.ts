import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { ExtensionState } from "./state.js";
import { MainLogic } from "./old-state.js";

// class SessionInfoItem extends vscode.TreeItem {
//   constructor(
//     public readonly label: string,
//     public readonly description: string,
//     public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
//   ) {
//     super(label, collapsibleState);

//     this.description = description;
//   }
// }

type Node = {
  label: string;
  description?: string;
  children?: Node[];
}

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
      node.children ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
    );
    item.description = node.description;
    return item;
  }

  getChildren(node?: Node): Node[] {
    if (node) {
      return node.children ?? [];
    }

    if (this.state.loading) {
      return [
        {
          label: "Loading..."
        }
      ];
    }

    if (this.state.session === null) { return []; }
    
    return [
      {
        label: "Session Info",
        children: [
          {
            label: "Room Code",
            description: this.state.session.roomCode,
          }
        ]
      },
      {
        label: "Participants",
        children: this.state.session.participants.map(p => {
          return {
            label: p.displayName
          }
        })
      }
    ];
  }
}
