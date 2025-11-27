import * as Y from "yjs";
import * as vscode from "vscode";

import { Awareness } from "y-protocols/awareness.js";
import { CursorSelection } from "./models/CursorSelection.js";
import { CustomDecorationType } from "./models/CustomDecoratorType.js";
import WebSocket from "ws";
import { WebsocketProvider } from "y-websocket";
import throttle from "lodash.throttle";

export interface SessionParticipant {
  clientId: number;
  displayName: string;
  color: string; // todo: could be enum?
}

export interface Session {
  roomCode: string;
  participants: SessionParticipant[];
}

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

export class ExtensionState {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  loading: boolean;

  session: Session | null;
  
  ws?: WebSocket;
  doc?: Y.Doc;
  provider?: WebsocketProvider;
  yText?: Y.Text;
  yUndoManager?: Y.UndoManager;
  awareness?: Awareness;
  
  editor?: vscode.TextEditor;
  editorChangeHandler?: vscode.Disposable;
  
  applyingRemoteChanges = false;
  applyingLocalChanges = false;
  
  decorationTypeMap = new Map<number, CustomDecorationType>();

  disposables: vscode.Disposable[];

  constructor() {
    this.loading = false;
    this.session = null;
    this.disposables = [];
  }

  dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }

  generateRoomCode(length = 6) {
    const chars = "1234567890";
    let code = "";
    for (let i = 0; i < length; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async hostSession() {
    if (this.session !== null) {
      vscode.window.showErrorMessage("You are already in a collaboration session.");
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showInformationMessage("Open a file to start collaboration.");
      return;
    }
  
    this.editor = activeEditor;

    this.loading = true;
    this._onDidChange.fire();

    let username = await vscode.window.showInputBox({
      title: "Display name",
      placeHolder: "Enter your display name for this session (empty to cancel)",
    });
    if (!username) { 
      vscode.window.showInformationMessage("Cancelled hosting collaboration session.");    
      this.loading = false;
      this._onDidChange.fire();
      return;
    }

    let roomCode = this.generateRoomCode();
    
    this.doc = new Y.Doc();
    this.provider = new WebsocketProvider("ws://localhost:1234", roomCode, this.doc);
    this.yText = this.doc.getText("vscode");
    this.yUndoManager = new Y.UndoManager(this.yText);
    this.awareness = this.provider.awareness;
    
    let userColor = usercolors[Math.floor(Math.random() * usercolors.length)];
    let user: SessionParticipant = {
      clientId: this.provider.awareness.clientID,
      displayName: username,
      color: userColor
    }

    this.session = {
      roomCode: roomCode,
      participants: [user],
    }
    
    this.awareness.setLocalStateField("user", {
      name: user.displayName,
      color: user.color
    });
  
    // loading initial text from remote
    // todo: fix bug for when collaborator already has text
    const yTextValue = this.yText.toString();
    const editorText = this.editor!.document.getText();
    if (editorText !== yTextValue) {
      this.editor!.edit((builder) => {
        builder.delete(
          new vscode.Range(
            this.editor!.document.positionAt(0),
            this.editor!.document.positionAt(editorText.length)
          )
        );
        builder.insert(this.editor!.document.positionAt(0), yTextValue);
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

    this.loading = false;

    vscode.window.showInformationMessage(
      `Collaboration session started with room code: ${roomCode}`,
      "Copy code to clipboard",
    ).then(async copy => {
      if (copy) {
        await vscode.env.clipboard.writeText(roomCode);
        vscode.window.showInformationMessage(`Copied room code ${roomCode} to clipboard!`);
      }
    });

    this._onDidChange.fire();
  }

  async joinSession() {
    // // 1. ask user for room code
    // // 2. ask user for username
    // // 3. connect to yjs room
    // // 4. synchronise all files and create documents
  
    // const activeEditor = vscode.window.activeTextEditor;
    // if (!activeEditor) {
    //   vscode.window.showInformationMessage("Open a file to start collaboration.");
    //   return;
    // }
  
    // this.editor = activeEditor;

    // // todo: check if valid room code with server
    // let roomCode = await vscode.window.showInputBox({
    //   title: "Room Code",
    //   placeHolder: "Enter the room code of the session you want to join (empty to cancel)",
    // });
    // if (!roomCode) { 
    //   vscode.window.showInformationMessage("Cancelled joining collaboration session.");
    //   return;
    // }

    // let username = await vscode.window.showInputBox({
    //   title: "Display name",
    //   placeHolder: "Enter your display name for this session (empty to cancel)",
    // });
    // if (!username) { 
    //   vscode.window.showInformationMessage("Cancelled hosting collaboration session.");    
    //   this.loading = false;
    //   return;
    // }

    // this.doc = new Y.Doc();
    // this.provider = new WebsocketProvider("ws://localhost:1234", roomCode, this.doc);
    // // this.yText = this.doc.getText("vscode");
    // // this.yUndoManager = new Y.UndoManager(this.yText);
    // this.awareness = this.provider.awareness;
    
    // let userColor = usercolors[Math.floor(Math.random() * usercolors.length)];
    // let user: SessionParticipant = {
    //   clientId: this.provider.awareness.clientID,
    //   displayName: username,
    //   color: userColor
    // }
    
    // this.awareness.setLocalStateField("user", {
    //   name: username,
    //   color: userColor
    // });

    if (this.session !== null) {
      vscode.window.showErrorMessage("You are already in a collaboration session.");
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showInformationMessage("Open a file to start collaboration.");
      return;
    }
  
    this.editor = activeEditor;

    this.loading = true;
    this._onDidChange.fire();

    const roomCode = await vscode.window.showInputBox({
      prompt: "Enter a collaboration room name",
      placeHolder: "Room Code"
    });
    if (!roomCode) {
      vscode.window.showInformationMessage(
        "Collaboration cancelled (no room name)."
      );
      this.loading = false;
      this._onDidChange.fire();
      return;
    }
    
    let username = await vscode.window.showInputBox({
      title: "Display name",
      placeHolder: "Enter your display name for this session (empty to cancel)",
    });
    if (!username) { 
      vscode.window.showInformationMessage("Cancelled joining collaboration session.");    
      this.loading = false;
      this._onDidChange.fire();
      return;
    }

    this.doc = new Y.Doc();
    this.provider = new WebsocketProvider("ws://localhost:1234", roomCode, this.doc);
    this.yText = this.doc.getText("vscode");
    this.yUndoManager = new Y.UndoManager(this.yText);
    this.awareness = this.provider.awareness;
    
    let userColor = usercolors[Math.floor(Math.random() * usercolors.length)];
    let user: SessionParticipant = {
      clientId: this.provider.awareness.clientID,
      displayName: username,
      color: userColor
    }

    this.session = {
      roomCode: roomCode,
      participants: [user],
    }
    
    this.awareness.setLocalStateField("user", {
      name: user.displayName,
      color: user.color
    });
  
    // loading initial text from remote
    // todo: fix bug for when collaborator already has text
    const yTextValue = this.yText.toString();
    const editorText = this.editor!.document.getText();
    if (editorText !== yTextValue) {
      this.editor!.edit((builder) => {
        builder.delete(
          new vscode.Range(
            this.editor!.document.positionAt(0),
            this.editor!.document.positionAt(editorText.length)
          )
        );
        builder.insert(this.editor!.document.positionAt(0), yTextValue);
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

    this.loading = false;
    this._onDidChange.fire();
  }

  endSession() {
    this.provider?.disconnect();

    this.dispose();
    this.session = null;
    this._onDidChange.fire();
  }

  disconnectSession() {
    
  }

  handleUndo() {
    // todo: handle when not in session
    this.yUndoManager?.undo();
  }
  
  handleRedo() {
    // todo: handle when not in session
    this.yUndoManager?.redo();
  }

  handleEditorTextChanged = (event: vscode.TextDocumentChangeEvent) => {
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
  
  handleEditorSelectionsChanged = (event: vscode.TextEditorSelectionChangeEvent) => {
    // if (editor !== event.textEditor) { return; }
    if (!this.awareness) { return; }
  
    this.awareness.setLocalStateField("cursor", {
      selections: event.textEditor.selections.map(sel => ({
        anchor: { line: sel.anchor.line, character: sel.anchor.character },
        head: { line: sel.active.line, character: sel.active.character },
      }))
    });
  }
  
  applyRemoteSelectionUpdate = ({added, updated, removed}: { added: Array<number>, updated: Array<number>, removed: Array<number> }) => {  
    if (!this.awareness || !this.editor) { return; }

    const allStates = this.awareness.getStates();

    added.forEach(id => {
      const state = allStates.get(id);
      const user = state?.user;
      if (!user) { return; }
      vscode.window.showInformationMessage(`User joined: ${user?.name ?? id}`);
      this.session!.participants.push({
        clientId: id,
        displayName: user.name,
        color: user.color,
      })
      this._onDidChange.fire();
    });

    removed.forEach(id => {
      this.session!.participants = this.session!.participants.filter(
        p => p.clientId !== id
      );

      this._onDidChange.fire();
    });
    
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
}