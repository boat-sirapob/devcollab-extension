import * as vscode from "vscode";

import { MainLogic } from "./logic.js";
import { MainSidebarProvider } from "./sidebar.js";

const logic = new MainLogic();

export function activate(context: vscode.ExtensionContext) {

	const provider = new MainSidebarProvider(context.extensionUri, logic);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(MainSidebarProvider.viewType, provider));

  const commands = [
    {
      command: "devcollab.openConnection",
      callback: logic.openConnection,
    },
    {
      command: "devcollab.sendMessage",
      callback: logic.sendMessage,
    },
    {
      command: "devcollab.undo",
      callback: logic.handleUndo,
    },
    {
      command: "devcollab.redo",
      callback: logic.handleRedo,
    },
  ];

  commands.forEach((c) => {
    const disposable = vscode.commands.registerCommand(c.command, c.callback.bind(logic));

    context.subscriptions.push(disposable);
  });
}

export function deactivate() {
  logic.dispose();
}
