import * as vscode from "vscode";

import { IUndoRedoService } from "../interfaces/IUndoRedoService.js";
import { inject, injectable } from "tsyringe";
import { IFileSystemService } from "../interfaces/IFileSystemService.js";
import { ITelemetryService } from "../interfaces/ITelemetryService.js";

@injectable()
export class UndoRedoService implements IUndoRedoService {
    constructor(
        @inject("IFileSystemService") private fileSystemService: IFileSystemService,
        @inject("ITelemetryService") private telemetryService: ITelemetryService
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

        this.telemetryService.recordAction("undo");
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

        this.telemetryService.recordAction("redo");
    }
}
