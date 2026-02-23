import * as Y from "yjs";
import * as vscode from "vscode";

import { DocumentBinding } from "../session/DocumentBinding.js";
import { WorkspaceItem } from "../models/WorkspaceItem.js";

export interface IFileSystemService {
    bindings: Map<string, DocumentBinding>;
    workspaceMap: Y.Map<Y.Text>;

    setupFileChangeHandling(): Promise<void>;
    setupFileWatcher(): void;
    fileChangeHandler: (event: Y.YMapEvent<Y.Text>) => Promise<void>;

    bindDocument(relPath: string, yText: Y.Text): Promise<void>;
    createFile(fileRelPath: string): Promise<vscode.TextDocument>;
    getFiles(currentDir?: string): Promise<WorkspaceItem[]>;
    getDocumentFromRelPath(relPath: string): vscode.TextDocument | undefined;
    getBindingsForDocument(doc: vscode.TextDocument): DocumentBinding | undefined;

    dispose(): void;
}