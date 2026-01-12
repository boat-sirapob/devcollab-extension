import * as Y from "yjs";
import * as vscode from "vscode";

import { Awareness } from "y-protocols/awareness.js";
import { CursorSelection } from "../models/CursorSelection.js";
import { CustomDecorationType } from "../models/CustomDecoratorType.js";
import WebSocket from "ws";
import { WebsocketProvider } from "y-websocket";
import throttle from "lodash.throttle";

const usercolors = [
  '#30bced',
  '#6eeb83',
  '#ffbc42',
  '#ecd444',
  '#ee6352',
  '#9ac2c9',
  '#8acb88',
  '#1be7ff'
];

export class MainLogic {
  ws: WebSocket | undefined;
  doc: Y.Doc | undefined;
  provider: WebsocketProvider | undefined;
  yText: Y.Text | undefined;
  yUndoManager: Y.UndoManager | undefined;
  awareness: Awareness | undefined;
  
  editor: vscode.TextEditor | undefined;
  editorChangeHandler: vscode.Disposable | undefined;
  
  applyingRemoteChanges = false;
  applyingLocalChanges = false;
  
  decorationTypeMap = new Map<number, CustomDecorationType>();
  
  dispose() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  async openConnection() {
    vscode.window.showInformationMessage("openConnection");
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
  
    this.editor = activeEditor;
  
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
  
    await this.startCollaboration(activeEditor, roomName);
  }
  
  async startCollaboration(editor: vscode.TextEditor, room: string) {
    if (!this.editor) { return; }

    vscode.window.showInformationMessage(
      `Yjs collaboration started in room: ${room}`
    );
  
    this.doc = new Y.Doc();
    this.provider = new WebsocketProvider("ws://localhost:1234", room, this.doc);
    this.yText = this.doc.getText("vscode");
    this.yUndoManager = new Y.UndoManager(this.yText);
    this.awareness = this.provider.awareness;
  
    // setup awareness
    let username: string | undefined;
    while (!username || username === "") {
      username = await vscode.window.showInputBox({
        title: "Display name",
        placeHolder: "Enter your display name for this session",
      });
    }
  
    this.awareness.setLocalStateField("user", {
      name: username,
      color: usercolors[Math.floor(Math.random() * usercolors.length)]
    });
  
    // loading initial text from remote
    const yTextValue = this.yText.toString();
    const editorText = this.editor.document.getText();
    if (editorText !== yTextValue) {
      this.editor.edit((builder) => {
        builder.delete(
          new vscode.Range(
            this.editor!.document.positionAt(0),
            this.editor!.document.positionAt(editorText.length)
          )
        );
        builder.insert(editor.document.positionAt(0), yTextValue);
      });
    }
  
    // pull remote text changes
    this.yText.observe(() => {
      if (!this.applyingLocalChanges) { this.applyRemoteTextUpdate(); }
    });
  
    // push local text changes
    vscode.workspace.onDidChangeTextDocument(this.handleEditorTextChanged);
  
    this.awareness.on("change", this.applyRemoteSelectionUpdate);
    
    // push local selection changes
    vscode.window.onDidChangeTextEditorSelection(this.handleEditorSelectionsChanged);
  }
  
  async endCollaboration() {
    this.provider?.disconnect();
  
    vscode.window.showInformationMessage("You have disconnected from the collaboration session.");
  }
  
  handleEditorTextChanged(event: vscode.TextDocumentChangeEvent) {
    if (!this.doc || !this.editor || !this.yText) { return; }

    if (this.applyingRemoteChanges) { return; }
    if (event.document !== this.editor.document) { return; }
  
    this.applyingLocalChanges = true;
    try {
      let changesCopy = [...event.contentChanges];
      this.doc.transact(() => {
        changesCopy
          .sort((change1, change2) => change2.rangeOffset - change1.rangeOffset)
          .forEach((change) => {
            this.yText!.delete(change.rangeOffset, change.rangeLength);
            this.yText!.insert(change.rangeOffset, change.text);
          });
      });
    } finally {
      this.applyingLocalChanges = false;
    }
  }
  
  applyRemoteTextUpdate = throttle(async () => {
    if (!this.editor || !this.yText || this.applyingLocalChanges) { return; }
  
    const fullText = this.yText.toString();
    const oldText = this.editor.document.getText();
  
    if (fullText === oldText) { return; }
  
    this.applyingRemoteChanges = true;
    try {
      await this.editor.edit((builder) => {
        builder.replace(
          new vscode.Range(
            this.editor!.document.positionAt(0),
            this.editor!.document.positionAt(oldText.length)
          ),
          fullText
        );
      });
    } finally {
      this.applyingRemoteChanges = false;
    }
  }, 40);
  
  handleEditorSelectionsChanged(event: vscode.TextEditorSelectionChangeEvent) {
    // if (editor !== event.textEditor) { return; }
    if (!this.awareness) { return; }
  
    this.awareness.setLocalStateField("cursor", {
      selections: event.textEditor.selections.map(sel => ({
        anchor: { line: sel.anchor.line, character: sel.anchor.character },
        head: { line: sel.active.line, character: sel.active.character },
      }))
    });
  }
  

  
  applyRemoteSelectionUpdate({added, updated, removed}: { added: Array<number>, updated: Array<number>, removed: Array<number> }) {  
    if (!this.awareness || !this.editor) { return; }

    const allStates = this.awareness.getStates();
    
    // vscode.window.showInformationMessage(JSON.stringify(Array.from(allStates.values())));
  
    // clear decorations
    for (const [clientId, decorations] of this.decorationTypeMap.entries()) {
      this.editor.setDecorations(decorations.selection, []);
      this.editor.setDecorations(decorations.cursor, []);
    }
  
    // set new decorations
    for (const [clientId, state] of allStates.entries()) {
      if (clientId === this.awareness.clientID) { continue; }
  
      const user = state.user;
      const cursor = state.cursor;
      if (!user || !cursor || !cursor.selections) { continue; }
  
      // Get or create decorations for this user
      let decorations = this.decorationTypeMap.get(clientId);
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
        this.decorationTypeMap.set(clientId, decorations);
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
  
      this.editor.setDecorations(decorations.selection, selectionRanges);
      this.editor.setDecorations(decorations.cursor, cursorOptions);
    }
  
    // remove decorations for users that left
    for (const clientId of removed) {
      const decorations = this.decorationTypeMap.get(clientId);
      if (decorations) {
        this.editor.setDecorations(decorations.selection, []);
        this.editor.setDecorations(decorations.cursor, []);
        decorations.selection.dispose();
        decorations.cursor.dispose();
        this.decorationTypeMap.delete(clientId);
      }
    }
  }
  
  sendMessage() {
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
      this.awareness?.setLocalStateField("user", {
        name: username,
        color: "#ffb61e",
      });
    });
  }
  
  handleUndo() {
    // todo: handle when not in session
    this.yUndoManager?.undo();
  }
  
  handleRedo() {
    // todo: handle when not in session
    this.yUndoManager?.redo();
  }
}