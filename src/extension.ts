import * as vscode from "vscode";

import WebSocket from "ws";

let ws: WebSocket;

function openConnection() {  
  ws = new WebSocket("ws://localhost:8080");

  ws.on("open", () => {
    vscode.window.showInformationMessage("Connected to server");
    ws.send("Hello from VS Code!");
  });

  ws.on("message", msg => {
    vscode.window.showInformationMessage(`Received: ${msg}`);
  });
}

function sendMessage() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    vscode.window.showInputBox({ prompt: "Message" }).then((message) => {
    
      if (message !== undefined && message === "") {
      return;
    }
    
    ws.send(message!);
  });
  } else {
    vscode.window.showWarningMessage("There is no ongoing connection.");
  }
}

export function activate(context: vscode.ExtensionContext) {
  const commands = [
    {
      command: "devcollab.openConnection",
      callback: openConnection
    },
    {
      command: "devcollab.sendMessage",
      callback: sendMessage
    }
  ];

  commands.forEach(c => {
    const disposable = vscode.commands.registerCommand(c.command, c.callback);
  
    context.subscriptions.push(disposable);
  });
}

export function deactivate() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
}
