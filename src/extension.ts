import * as Y from "yjs";
import * as vscode from "vscode";

import { Awareness } from "y-protocols/awareness.js";
import WebSocket from "ws";
import { WebsocketProvider } from "y-websocket";
import throttle from "lodash.throttle";

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

let decorationTypeMap = new Map<number, CustomDecorationType>()

const usercolors = [
  '#30bced',
  '#6eeb83',
  '#ffbc42',
  '#ecd444',
  '#ee6352',
  '#9ac2c9',
  '#8acb88',
  '#1be7ff'
]

interface CustomDecorationType {
  selection: vscode.TextEditorDecorationType,
  cursor: vscode.TextEditorDecorationType,
}

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

  await startCollaboration(activeEditor, roomName);
}

async function startCollaboration(editor: vscode.TextEditor, room: string) {
  vscode.window.showInformationMessage(
    `Yjs collaboration started in room: ${room}`
  );

  doc = new Y.Doc();
  provider = new WebsocketProvider("ws://localhost:1234", room, doc);
  yText = doc.getText("vscode");
  yUndoManager = new Y.UndoManager(yText);
  awareness = provider.awareness;

  // setup awareness
  let username: string | undefined;
  while (!username || username === "") {
    username = await vscode.window.showInputBox({
      title: "Display name",
      placeHolder: "Enter your display name for this session",
    });
  }

  awareness.setLocalStateField("user", {
    name: username,
    color: usercolors[Math.floor(Math.random() * usercolors.length)]
  })

  // loading initial text from remote
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

  // pull remote text changes
  yText.observe(() => {
    if (!applyingLocalChanges) applyRemoteTextUpdate();
  });

  // push local text changes
  vscode.workspace.onDidChangeTextDocument(handleEditorTextChanged);

  awareness.on("change", applyRemoteSelectionUpdate);
  
  // push local selection changes
  vscode.window.onDidChangeTextEditorSelection(handleEditorSelectionsChanged);
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

const applyRemoteTextUpdate = throttle(async () => {
  if (!editor || applyingLocalChanges) return;

  const fullText = yText.toString();
  const oldText = editor.document.getText();

  if (fullText === oldText) return;

  applyingRemoteChanges = true;
  try {
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

function handleEditorSelectionsChanged(event: vscode.TextEditorSelectionChangeEvent) {
  // if (editor !== event.textEditor) { return; }

  awareness.setLocalStateField("cursor", {
    selections: event.textEditor.selections.map(sel => ({
      anchor: { line: sel.anchor.line, character: sel.anchor.character },
      head: { line: sel.active.line, character: sel.active.character },
    }))
  })
}


interface CursorSelection {
  anchor: { line: number; character: number }
  head: { line: number; character: number }
}

function applyRemoteSelectionUpdate({added, updated, removed}: { added: Array<number>, updated: Array<number>, removed: Array<number> }) {  
  const allStates = awareness.getStates() 
  
  // vscode.window.showInformationMessage(JSON.stringify(Array.from(allStates.values())));

  // clear decorations
  for (const [clientId, decorations] of decorationTypeMap.entries()) {
    editor.setDecorations(decorations.selection, []);
    editor.setDecorations(decorations.cursor, []);
  }

  // set new decorations
  for (const [clientId, state] of allStates.entries()) {
    if (clientId === awareness.clientID) continue;

    const user = state.user;
    const cursor = state.cursor;
    if (!user || !cursor || !cursor.selections) continue;

    // Get or create decorations for this user
    let decorations = decorationTypeMap.get(clientId);
    if (!decorations) {
      const selectionDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: `${user.color}40`,
        overviewRulerColor: user.color,
        overviewRulerLane: vscode.OverviewRulerLane.Right,
      });

      const cursorDecoration = vscode.window.createTextEditorDecorationType({
        borderColor: user.color,
        borderWidth: "1px",
        borderStyle: "solid",
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        overviewRulerColor: user.color,
        overviewRulerLane: vscode.OverviewRulerLane.Right,
      });

      decorations = { selection: selectionDecoration, cursor: cursorDecoration };
      decorationTypeMap.set(clientId, decorations);
    }

    const selectionRanges: vscode.Range[] = [];
    const cursorRanges: vscode.Range[] = [];

    for (const sel of cursor.selections as CursorSelection[]) {
      // Highlight the selection range (if any)
      if (!(sel.anchor.line === sel.head.line && sel.anchor.character === sel.head.character)) {
        selectionRanges.push(
          new vscode.Range(
            new vscode.Position(sel.anchor.line, sel.anchor.character),
            new vscode.Position(sel.head.line, sel.head.character)
          )
        );
      }

      // Draw the cursor border only at the head position
      cursorRanges.push(
        new vscode.Range(
          new vscode.Position(sel.head.line, sel.head.character),
          new vscode.Position(sel.head.line, sel.head.character)
        )
      );
    }
    
    const cursorOptions: vscode.DecorationOptions[] = cursorRanges.map((range) => ({
      range,
      hoverMessage: new vscode.MarkdownString(`**${user.name}**`),
    }));

    editor.setDecorations(decorations.selection, selectionRanges);
    editor.setDecorations(decorations.cursor, cursorOptions);
  }

  // remove decorations for users that left
  for (const clientId of removed) {
    const decorations = decorationTypeMap.get(clientId);
    if (decorations) {
      editor.setDecorations(decorations.selection, []);
      editor.setDecorations(decorations.cursor, []);
      decorations.selection.dispose();
      decorations.cursor.dispose();
      decorationTypeMap.delete(clientId);
    }
  }
}

function sendMessage() {
  // if (ws && ws.readyState === WebSocket.OPEN) {
  //   vscode.window.showInputBox({ prompt: "Message" }).then((message) => {
  //     if (message !== undefined && message === "") {
  //       return;
  //     }

  //     ws.send(message!);
  //   });
  // } else {
  //   vscode.window.showWarningMessage("There is no ongoing connection.");
  // }

  
  vscode.window.showInputBox({ prompt: "Username" }).then((username) => {
    awareness.setLocalStateField("user", {
      name: username,
      color: "#ffb61e",
    })
  });
}

function handleUndo() {
  yUndoManager.undo();
}

function handleRedo() {
  yUndoManager.redo();
}


class MainSidebarProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = "devcollab";

  resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
    
    webviewView.webview.html = `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<title>DevCollab</title>
			</head>
			<body>
				<button class="host-button">Host Session</button>
			</body>
			</html>`;
  }
}


export function activate(context: vscode.ExtensionContext) {

	const provider = new MainSidebarProvider();

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(MainSidebarProvider.viewType, provider));

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
}
