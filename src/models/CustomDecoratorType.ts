import * as vscode from "vscode";

export interface CustomDecorationType {
    selection: vscode.TextEditorDecorationType;
    cursor: vscode.TextEditorDecorationType;
    followingCursor: vscode.TextEditorDecorationType;
}
