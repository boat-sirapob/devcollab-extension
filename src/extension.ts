import * as vscode from "vscode";

import { ExtensionState } from "./state.js";
import { SessionInfoSidebarProvider } from "./ui/sidebar/SessionInfoSidebarProvider.js";
import { StatusBarProvider } from "./ui/status-bar/StatusBarProvider.js";

const state = new ExtensionState();

export function activate(context: vscode.ExtensionContext) {
  initializeState(context);
  registerSidebar(context);
  registerCommands(context);
  registerStatusBar(context);
}

export function initializeState(context: vscode.ExtensionContext) {
  state.setContext(context);

  state.restorePendingSession()
    .then(() => {
      state.cleanupOldTempDirs();
    })
    .catch(err => {
      console.error("Failed to restore pending session:", err);
    });
  
  vscode.commands.executeCommand("setContext", "devcollab.isInSession", false);

  state.onDidChange(() => {
    vscode.commands.executeCommand("setContext", "devcollab.isInSession", state.session !== null);
  }, context.subscriptions);
}

export function registerSidebar(context: vscode.ExtensionContext) {
  const sidebarProvider = new SessionInfoSidebarProvider(state);
  vscode.window.createTreeView("devcollab", {
    treeDataProvider: sidebarProvider
  });
}

export function registerCommands(context: vscode.ExtensionContext) {
  const commands = [
    {
      command: "devcollab.test",
      callback: state.test,
    },
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
    {
      command: "devcollab.copyRoomCode",
      callback: state.copyRoomCode,
    },
  ];

  commands.forEach((c) => {
    const disposable = vscode.commands.registerCommand(c.command, c.callback.bind(state));

    context.subscriptions.push(disposable);
  });
}

export function registerStatusBar(context: vscode.ExtensionContext) {
  const statusBarProvider = new StatusBarProvider(state);
  context.subscriptions.push(statusBarProvider.getStatusBarItem());
}

export function deactivate() {
  state.dispose();
}
