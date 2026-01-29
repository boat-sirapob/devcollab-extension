import * as vscode from "vscode";

import { ExtensionState } from "../../state.js";

export class StatusBarProvider {
  private statusBarItem: vscode.StatusBarItem;
  private state: ExtensionState;

  constructor(state: ExtensionState) {
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
    if (this.state.session && this.state.session.connected) {
      this.statusBarItem.text = `$(broadcast) Connected: ${this.state.session.roomCode}`;
      this.statusBarItem.tooltip = `DevCollab - Room: ${this.state.session.roomCode}\nClick to disconnect`;
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.command = "devcollab.endSession";
    } else if (this.state.session && !this.state.session.connected) {
      this.statusBarItem.text = "$(debug-disconnect) Disconnected";
      this.statusBarItem.tooltip = "DevCollab - Disconnected\nClick to end session";
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.statusBarItem.command = "devcollab.endSession";
    } else {
      this.statusBarItem.text = "$(circle-slash) No Session";
      this.statusBarItem.tooltip = "DevCollab - Not in a session";
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.command = undefined;
    }
    this.statusBarItem.show();
  }

  getStatusBarItem(): vscode.StatusBarItem {
    return this.statusBarItem;
  }
}
