import * as Y from "yjs";
import * as vscode from "vscode";

import { createMutex, mutex } from "lib0/mutex";

import { Awareness } from "y-protocols/awareness.js";
import throttle from "lodash.throttle";

export class DocumentBinding {
  yText: Y.Text;
  doc: vscode.TextDocument;
  awareness: Awareness;

  applyingRemote: boolean;
  mux: mutex;

  constructor(yText: Y.Text, doc: vscode.TextDocument, awareness: Awareness) {
    this.yText = yText;
    this.doc = doc;
    this.awareness = awareness;
    
    this.applyingRemote = false;
    this.mux = createMutex();

    this.yText.observe(
      throttle(async (event: Y.YTextEvent, transaction: Y.Transaction) => {
        if (transaction.origin === this) { return; }
        
        await this.mux(async () => {
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
        })
      }, 40)
    );

    // push local text changes
    vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
      this.mux(() => {
        if (this.doc !== event.document || this.applyingRemote) { return; }
        
        vscode.window.showInformationMessage(`Test ${event.document.fileName}`);
  
        let changesCopy = [...event.contentChanges];
        this.yText.doc!.transact(() => {
          changesCopy
            .sort((change1, change2) => change2.rangeOffset - change1.rangeOffset)
            .forEach((change) => {
              this.yText.delete(change.rangeOffset, change.rangeLength);
              this.yText.insert(change.rangeOffset, change.text);
            });
        }, this);
      })
    });

    // push local selection changes
    vscode.window.onDidChangeTextEditorSelection((event: vscode.TextEditorSelectionChangeEvent) => {
      if (event.textEditor !== vscode.window.activeTextEditor) { return; }

      this.awareness.setLocalStateField("cursor", {
        selections: event.textEditor.selections.map(sel => ({
          anchor: { line: sel.anchor.line, character: sel.anchor.character },
          head: { line: sel.active.line, character: sel.active.character },
        }))
      });
    });
  }
}