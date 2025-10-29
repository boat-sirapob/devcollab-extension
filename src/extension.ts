import * as Y from "yjs";
import * as vscode from "vscode";

import WebSocket from "ws";
import { WebsocketProvider } from "y-websocket";
import throttle from "lodash.throttle";
import { Awareness } from "y-protocols/awareness.js";

let ws: WebSocket | undefined;
let doc: Y.Doc;
let provider: WebsocketProvider;
let yText: Y.Text;
let yUndoManager: Y.UndoManager;
let awareness: Awareness;

let editor: vscode.TextEditor;
let editorChangeHandler: vscode.Disposable;

let applyingRemoteChanges = false;
let applyingLocalChanges = false;

async function openConnection() {
  // ws = new WebSocket("ws://localhost:8080");

  // ws.on("open", () => {
  //   vscode.window.showInformationMessage("Connected to server");
  //   ws.send("Hello from VS Code!");
  // });

  // ws.on("message", msg => {
  //   vscode.window.showInformationMessage(`Received: ${msg}`);
  // });

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showInformationMessage("Open a file to start collaboration.");
    return;
  }

  editor = activeEditor;

  // const roomName = await vscode.window.showInputBox({
  //   prompt: "Enter a collaboration room name",
  //   placeHolder: "example: project-alpha"
  // });

  let roomName = "devcollab-test";

  if (!roomName) {
    vscode.window.showInformationMessage(
      "Collaboration cancelled (no room name)."
    );
    return;
  }

  startCollaboration(activeEditor, roomName);
}

function startCollaboration(editor: vscode.TextEditor, room: string) {
  doc = new Y.Doc();
  provider = new WebsocketProvider("ws://localhost:1234", room, doc);
  yText = doc.getText("vscode");
  yUndoManager = new Y.UndoManager(yText);
  awareness = provider.awareness;

  vscode.window.showInputBox({
    title: "Display name",
    placeHolder: "Enter your display name for this session",
  });

  vscode.window.showInformationMessage(
    `Yjs collaboration started in room: ${room}`
  );

  provider.on("status", (event) => {
    vscode.window.showInformationMessage(event.status);
  });

  yText.observe(() => {
    if (!applyingLocalChanges) applyRemoteUpdate();
  });

  const yTextValue = yText.toString();
  const editorText = editor.document.getText();
  if (editorText !== yTextValue) {
    editor.edit((builder) => {
      builder.delete(
        new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editorText.length)
        )
      );
      builder.insert(editor.document.positionAt(0), yTextValue);
    });
  }

  editorChangeHandler = vscode.workspace.onDidChangeTextDocument(
    handleEditorTextChanged
  );
}

function handleEditorTextChanged(event: vscode.TextDocumentChangeEvent) {
  if (applyingRemoteChanges) return;
  if (event.document !== editor.document) return;

  applyingLocalChanges = true;
  try {
    let changesCopy = [...event.contentChanges];
    doc.transact(() => {
      changesCopy
        .sort((change1, change2) => change2.rangeOffset - change1.rangeOffset)
        .forEach((change) => {
          yText.delete(change.rangeOffset, change.rangeLength);
          yText.insert(change.rangeOffset, change.text);
        });
    });
  } finally {
    applyingLocalChanges = false;
  }
}

const applyRemoteUpdate = throttle(async () => {
  if (!editor || applyingLocalChanges) return;

  const fullText = yText.toString();
  const oldText = editor.document.getText();

  if (fullText === oldText) return;

  applyingRemoteChanges = true;
  try {
    // const edit = new vscode.WorkspaceEdit();
    // const uri = editor.document.uri;

    // edit.replace(
    //   uri,
    //   new vscode.Range(
    //     editor.document.positionAt(0),
    //     editor.document.positionAt(oldText.length)
    //   ),
    //   fullText
    // );

    // await vscode.workspace.applyEdit(edit);

    await editor.edit((builder) => {
      builder.replace(
        new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(oldText.length)
        ),
        fullText
      );
    });
  } finally {
    applyingRemoteChanges = false;
  }
}, 40);

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

function handleUndo() {
  yUndoManager.undo();
}

function handleRedo() {
  yUndoManager.redo();
}

export function activate(context: vscode.ExtensionContext) {
  const commands = [
    {
      command: "devcollab.openConnection",
      callback: openConnection,
    },
    {
      command: "devcollab.sendMessage",
      callback: sendMessage,
    },
    {
      command: "devcollab.undo",
      callback: handleUndo,
    },
    {
      command: "devcollab.redo",
      callback: handleRedo,
    },
  ];

  commands.forEach((c) => {
    const disposable = vscode.commands.registerCommand(c.command, c.callback);

    context.subscriptions.push(disposable);
  });
}

export function deactivate() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }

  // yText.unobserve(yTextObserver);
  editorChangeHandler.dispose();
}
