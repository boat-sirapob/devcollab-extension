import * as Y from "yjs";
import * as vscode from "vscode";

import { Awareness } from "y-protocols/awareness.js";
import { CursorSelection } from "../models/CursorSelection.js";
import { CustomDecorationType } from "../models/CustomDecoratorType.js";
import { absoluteToRelative } from "../helpers/Utilities.js";
import throttle from "lodash.throttle";

export class DocumentBinding {
  yText: Y.Text;
  doc: vscode.TextDocument;
  rootPath: string;
  awareness: Awareness;

  applyingRemote: boolean;
  remoteChangeQueue: Promise<void> = Promise.resolve();

  yUndoManager?: Y.UndoManager;
  
  decorationTypeMap = new Map<number, CustomDecorationType>();

  // for cleanup
  private yTextObserver?: (event: Y.YTextEvent, transaction: Y.Transaction) => void;
  private applyRemoteChange?: () => void;
  private applyRemoteChangeThrottled?: ((...args: any[]) => any) & { cancel?: () => void; flush?: () => void };
  private textDocumentChangeListener?: vscode.Disposable;
  private awarenessChangeListener?: (event: { added: Array<number>, updated: Array<number>, removed: Array<number> }) => void;
  private textEditorSelectionListener?: vscode.Disposable;

  constructor(yText: Y.Text, doc: vscode.TextDocument, rootPath: string, awareness: Awareness) {
    this.yText = yText;
    this.doc = doc;
    this.rootPath = rootPath;
    this.awareness = awareness;
    
    this.applyingRemote = false;

    this.yUndoManager = new Y.UndoManager(this.yText, { trackedOrigins: new Set([this]) });

    
    this.applyRemoteChangeThrottled = throttle(async () => {
      this.remoteChangeQueue = this.remoteChangeQueue.then(async () => {
        const fullText = this.yText.toString();
        const oldText = this.doc.getText();
        
        if (fullText === oldText) { return; }

        this.applyingRemote = true;
        
        try {
          let edit = new vscode.WorkspaceEdit();
          edit.replace(
            this.doc.uri,
            new vscode.Range(
              this.doc.positionAt(0),
              this.doc.positionAt(oldText.length)
            ),
            fullText
          );
          await vscode.workspace.applyEdit(edit);
        } finally {
          this.applyingRemote = false;
        }
      });
    }, 40);

    this.applyRemoteChange = () => {
      if (this.applyRemoteChangeThrottled) {
        this.applyRemoteChangeThrottled();
      }
    };

    this.yTextObserver = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      if (transaction.origin === this) { return; }
      
      this.applyRemoteChange!();
    };

    this.yText.observe(this.yTextObserver);

    // push local text changes
    this.textDocumentChangeListener = vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
      if (this.doc !== event.document || this.applyingRemote) { return; }
      
      let changesCopy = [...event.contentChanges];
      this.yText.doc!.transact(() => {
        changesCopy
          .sort((change1, change2) => change2.rangeOffset - change1.rangeOffset)
          .forEach((change) => {
            this.yText.delete(change.rangeOffset, change.rangeLength);
            this.yText.insert(change.rangeOffset, change.text);
          });
      }, this);
    });

    // initial push
    if (yText.toString().length === 0 && doc.getText().length > 0) {
      yText.doc!.transact(() => {
        yText.insert(0, doc.getText());
      }, this);
    }

    // initial load
    this.remoteChangeQueue = this.remoteChangeQueue.then(async () => {
      const fullText = this.yText.toString();
      const oldText = this.doc.getText();
      if (fullText === oldText) { return; }

      this.applyingRemote = true;
      try {
        let edit = new vscode.WorkspaceEdit();
        edit.replace(
          this.doc.uri,
          new vscode.Range(
            this.doc.positionAt(0),
            this.doc.positionAt(oldText.length)
          ),
          fullText
        );
        await vscode.workspace.applyEdit(edit);
      } finally {
        this.applyingRemote = false;
      }
    });

    // todo: make name tag disappear after some time / appear on hover? 
    // todo: test with multiple guests
    this.awarenessChangeListener = ({added, updated, removed}: { added: Array<number>, updated: Array<number>, removed: Array<number> }) => { 
      const allStates = this.awareness.getStates();
  
      const editor = vscode.window.visibleTextEditors.find(e => e.document.uri === this.doc.uri);

      if (!editor) { return; }

      // clear decorations
      for (const [clientId, decorations] of this.decorationTypeMap.entries()) {
        editor.setDecorations(decorations.selection, []);
        editor.setDecorations(decorations.cursor, []);
      }
    
      // set new decorations
      for (const [clientId, state] of allStates.entries()) {
        if (clientId === this.awareness.clientID) { continue; }
        
        const user = state.user;
        const cursor = state.cursor;
        
        if (!user || !cursor || !cursor.selections || cursor.uri !== this.relUri) { continue; }
    
        let decorations = this.decorationTypeMap.get(clientId);
        if (!decorations) {
          const selectionDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: `${user.color}40`,
            overviewRulerColor: user.color,
            overviewRulerLane: vscode.OverviewRulerLane.Right,
          });
    
          const cursorDecoration = vscode.window.createTextEditorDecorationType({
            before: {
              backgroundColor: `${user.color}`,
              contentText: user.name,
              textDecoration: "none; position: absolute; top: var(--vscode-editorCodeLens-lineHeight); padding: 2px; color: black;"
            },
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
          if (!(sel.anchor.line === sel.head.line && sel.anchor.character === sel.head.character)) {
            selectionRanges.push(
              new vscode.Range(
                new vscode.Position(sel.anchor.line, sel.anchor.character),
                new vscode.Position(sel.head.line, sel.head.character)
              )
            );
          }
    
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
    };

    this.awareness.on("change", this.awarenessChangeListener);

    // push local selection changes
    this.textEditorSelectionListener = vscode.window.onDidChangeTextEditorSelection((event: vscode.TextEditorSelectionChangeEvent) => {
      if (event.textEditor.document.uri !== this.doc.uri) { return; }

      // todo: type safety
      this.awareness.setLocalStateField("cursor", {
        uri: absoluteToRelative(event.textEditor.document.uri.fsPath.toString(), this.rootPath),
        selections: event.textEditor.selections.map(sel => ({
          anchor: { line: sel.anchor.line, character: sel.anchor.character },
          head: { line: sel.active.line, character: sel.active.character },
        }))
      });
    });
  }

  get relUri() {
    return absoluteToRelative(this.doc.uri.fsPath.toString(), this.rootPath);
  }

  dispose() {
    if (this.yTextObserver) {
      this.yText.unobserve(this.yTextObserver);
    }

    if (this.applyRemoteChangeThrottled?.flush) {
      this.applyRemoteChangeThrottled.flush();
    }

    if (this.awarenessChangeListener) {
      this.awareness.off("change", this.awarenessChangeListener);
    }

    if (this.textDocumentChangeListener) {
      this.textDocumentChangeListener.dispose();
    }
    if (this.textEditorSelectionListener) {
      this.textEditorSelectionListener.dispose();
    }

    if (this.yUndoManager) {
      this.yUndoManager.destroy();
    }

    for (const decorations of this.decorationTypeMap.values()) {
      decorations.selection.dispose();
      decorations.cursor.dispose();
    }
    this.decorationTypeMap.clear();
  }
}