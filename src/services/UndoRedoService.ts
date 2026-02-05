import * as vscode from "vscode";

import { IUndoRedoService } from "../interfaces/IUndoRedoService.js";
import { inject } from "tsyringe";
import { IFileSystemService } from "../interfaces/IFileSystemService.js";

export class UndoRedoService implements IUndoRedoService {
    constructor(
        @inject("IFileSystemService") private fileSystemService: IFileSystemService,
    ) { }

    handleUndo() {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.commands.executeCommand("undo");
            return;
        }

        const binding = this.fileSystemService.getBindingsForDocument(editor.document);

        if (binding?.yUndoManager) {
            binding.yUndoManager.undo();
        } else {
            vscode.commands.executeCommand("undo");
        }
    }

    handleRedo() {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.commands.executeCommand("redo");
            return;
        }

        const binding = this.fileSystemService.getBindingsForDocument(editor.document);

        if (binding?.yUndoManager) {
            binding.yUndoManager.redo();
        } else {
            vscode.commands.executeCommand("redo");
        }
    }
}
