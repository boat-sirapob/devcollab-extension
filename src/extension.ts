import * as vscode from "vscode";

import { ExtensionState } from "./state.js";
import { SessionInfoSidebarProvider } from "./sidebar.js";

const state = new ExtensionState();

export function activate(context: vscode.ExtensionContext) {
  vscode.commands.executeCommand('setContext', 'devcollab.isInSession', false);

  state.onDidChange(() => {
    vscode.commands.executeCommand('setContext', 'devcollab.isInSession', state.session !== null);
  }, context.subscriptions);

  const sidebarProvider = new SessionInfoSidebarProvider(state);
  vscode.window.createTreeView("devcollab", {
    treeDataProvider: sidebarProvider
  });

  const commands = [
    {
      command: "devcollab.hostSession",
      callback: state.hostSession,
    },
    {
      command: "devcollab.joinSession",
      callback: state.joinSession,
    },
    {
      command: "devcollab.endSession",
      callback: state.endSession,
    },
    {
      command: "devcollab.undo",
      callback: state.handleUndo,
    },
    {
      command: "devcollab.redo",
      callback: state.handleRedo,
    },
  ];

  commands.forEach((c) => {
    const disposable = vscode.commands.registerCommand(c.command, c.callback.bind(state));

    context.subscriptions.push(disposable);
  });
}

export function deactivate() {
  state.dispose();
}
