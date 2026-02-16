import * as Y from "yjs";
import * as path from "path";
import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { readdir } from "fs/promises";

import { IFileSystemService } from "../interfaces/IFileSystemService.js";
import { DocumentBinding } from "../session/DocumentBinding.js";
import { WorkspaceItem } from "../models/WorkspaceItem.js";
import { FileSystemUtilities } from "../helpers/FileSystemUtilities.js";
import { absoluteToRelative, relativeToAbsolute } from "../helpers/Utilities.js";
import { Session } from "../session/Session.js";
import { IFollowService } from "../interfaces/IFollowService.js";
import { ISessionService } from "../interfaces/ISessionService.js";

@injectable()
export class FileSystemService implements IFileSystemService {
    bindings: Map<string, DocumentBinding> = new Map();
    workspaceMap: Y.Map<Y.Text>;
    private fileSystemWatcher?: vscode.FileSystemWatcher;
    private isApplyingRemoteChange: boolean = false;
    private rootPath: string;

    constructor(
        @inject("Session") private session: Session,
        @inject("ISessionService") private sessionService: ISessionService
    ) {
        this.workspaceMap = session.doc.getMap<Y.Text>("workspace-map");
        this.rootPath = session.rootPath;
    }

    setupFileChangeHandling() {
        this.workspaceMap.observe(this.fileChangeHandler);
        this.setupFileWatcher();
    }

    setupFileWatcher() {
        const pattern = new vscode.RelativePattern(this.rootPath, "**");
        this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        // handle file creation
        this.fileSystemWatcher.onDidCreate(async (uri: vscode.Uri) => {
            if (this.isApplyingRemoteChange) return;

            const relPath = absoluteToRelative(uri.fsPath, this.rootPath);
            const stat = await vscode.workspace.fs.stat(uri);

            if (stat.type === vscode.FileType.File) {
                if (!this.workspaceMap.has(relPath)) {
                    const yText = new Y.Text();
                    this.workspaceMap.set(relPath, yText);
                    await this.bindDocument(relPath, yText);
                }
            }
        });

        // handle file deletion
        this.fileSystemWatcher.onDidDelete((uri: vscode.Uri) => {
            if (this.isApplyingRemoteChange) return;

            const relPath = absoluteToRelative(uri.fsPath, this.rootPath);

            if (this.workspaceMap.has(relPath)) {
                this.workspaceMap.delete(relPath);
                const binding = this.bindings.get(relPath);
                if (binding) {
                    binding.dispose();
                }
                this.bindings.delete(relPath);
            }
        });
    }

    fileChangeHandler = async (event: Y.YMapEvent<Y.Text>) => {
        this.isApplyingRemoteChange = true;
        try {
            for (const key of event.keysChanged) {
                const yText = this.workspaceMap.get(key);

                if (yText) {
                    // sync file creation
                    if (!this.bindings.has(key)) {
                        await this.createFile(key);
                        await this.bindDocument(key, yText);
                    }
                } else {
                    // sync file deletion
                    const fileUri = vscode.Uri.file(
                        relativeToAbsolute(key, this.rootPath)
                    );
                    try {
                        await FileSystemUtilities.saveFile(fileUri);
                        await FileSystemUtilities.closeFileInEditor(fileUri);

                        await vscode.workspace.fs.delete(fileUri);

                        const binding = this.bindings.get(key);
                        if (binding) {
                            binding.dispose();
                        }
                        this.bindings.delete(key);
                    } catch (e) {
                        console.error(`Failed to delete file ${key}:`, e);
                    }
                }
            }
        } finally {
            this.isApplyingRemoteChange = false;
        }
    };

    async bindDocument(relPath: string, yText: Y.Text): Promise<void> {
        const oldBinding = this.bindings.get(relPath);
        if (oldBinding) {
            oldBinding.dispose();
        }

        const filePath = vscode.Uri.file(
            relativeToAbsolute(relPath, this.rootPath)
        );
        const doc = await vscode.workspace.openTextDocument(filePath);

        const followService = this.sessionService.get<IFollowService>("IFollowService");

        const binding = new DocumentBinding(
            followService,
            yText,
            doc,
            this.rootPath,
            this.session.awareness
        );
        this.bindings.set(relPath, binding);
    }

    async createFile(fileRelPath: string): Promise<vscode.TextDocument> {
        const fileUri = vscode.Uri.file(
            relativeToAbsolute(fileRelPath, this.rootPath)
        );

        const dirUri = vscode.Uri.joinPath(fileUri, "..");
        await vscode.workspace.fs.createDirectory(dirUri);

        try {
            await vscode.workspace.fs.stat(fileUri);
        } catch {
            await vscode.workspace.fs.writeFile(fileUri, new Uint8Array());
        } finally {
            return await vscode.workspace.openTextDocument(fileUri);
        }
    }

    async getFiles(currentDir: string = this.rootPath): Promise<WorkspaceItem[]> {
        const entries = await readdir(currentDir, { withFileTypes: true });
        const files: WorkspaceItem[] = [];

        for (const entry of entries) {
            const absolutePath = path.join(currentDir, entry.name);
            const relativePath = absoluteToRelative(
                absolutePath,
                this.rootPath
            );

            if (entry.isDirectory()) {
                files.push(...(await this.getFiles(absolutePath)));
            } else {
                files.push({
                    name: entry.name,
                    path: relativePath,
                });
            }
        }

        return files;
    }

    getDocumentFromRelPath(relPath: string): vscode.TextDocument | undefined {
        return this.bindings.get(relPath)?.doc;
    }

    getRelPathFromDocument(doc: vscode.TextDocument): string {
        return absoluteToRelative(
            doc.uri.fsPath.toString(),
            this.session.rootPath
        );
    }

    getBindingsForDocument(doc: vscode.TextDocument): DocumentBinding | undefined {
        const relPath = this.getRelPathFromDocument(doc);
        const binding = this.bindings.get(relPath);
        return binding;
    }

    dispose(): void {
        for (const binding of this.bindings.values()) {
            binding.dispose();
        }
        this.bindings.clear();

        if (this.fileSystemWatcher) {
            this.fileSystemWatcher.dispose();
        }
    }
}
