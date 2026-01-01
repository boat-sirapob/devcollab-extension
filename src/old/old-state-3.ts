import * as Y from "yjs";
import * as path from "path";
import * as vscode from "vscode";

import { absoluteToRelative, isDirectoryEmpty, relativeToAbsolute } from "../helpers/utilities.js";

import { Awareness } from "y-protocols/awareness.js";
import { CursorSelection } from "../models/CursorSelection.js";
import { CustomDecorationType } from "../models/CustomDecoratorType.js";
import WebSocket from "ws";
import { WebsocketProvider } from "y-websocket";
import { readdir } from "fs/promises";
import throttle from "lodash.throttle";

export interface SessionParticipant {
  clientId: number;
  displayName: string;
  color: string;
}

export type WorkspaceFile = {
  type: "file",
  name: string,
  path: string,
}

export type WorkspaceFolder = {
  type: "folder",
  name: string,
  path: string,
  children: WorkspaceItem[]
}

export type WorkspaceItem = WorkspaceFile | WorkspaceFolder;

type CollabDoc = {
  path: string,
  yText: Y.Text
}

export class Session {
  roomCode: string;
  participants: SessionParticipant[];
  doc: Y.Doc;
  workspaceMap: Y.Map<Y.Text>
  provider: WebsocketProvider;
  awareness: Awareness;
  rootPath: string;

  constructor(roomCode: string, rootPath: string) {
    this.roomCode = roomCode;
    this.participants = [];
    this.doc = new Y.Doc();
    this.provider = new WebsocketProvider("ws://localhost:1234", roomCode, this.doc);
    this.workspaceMap = this.doc.getMap<Y.Text>("workspace-map");
    this.awareness = this.provider.awareness;
    this.rootPath = rootPath;
  }

  async bindDocument(file: WorkspaceItem) {
    if (file.type === "folder") {
      for (const child of file.children) {
        await this.bindDocument(child);
      }
      return;
    }

    const filePath = vscode.Uri.file(relativeToAbsolute(file.path, this.rootPath));
    const doc = await vscode.workspace.openTextDocument(filePath);
    
    // const ytext = this.doc.getText(file.path);
    const ytext = new Y.Text();
    
    const binding = new DocumentBinding(ytext, doc);
    this.workspaceMap.set(file.path, ytext);
  }

  async createFile(
    fileRelPath: string
  ): Promise<vscode.TextDocument> {
    const fileUri = vscode.Uri.file(relativeToAbsolute(fileRelPath, this.rootPath));

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

enum WorkspaceType {
  SingleFile,
  SingleRootFolder,
  MultiRootFolder,
  Empty,
}

enum ServerMessageType {
  HostResponse = "hostResponse",
}

interface ServerMessage {
  type: ServerMessageType
}

export class DocumentBinding {
  yText: Y.Text;
  doc: vscode.TextDocument;
  applyingLocalChanges: boolean;
  applyingRemoteChanges: boolean;

  constructor(yText: Y.Text, doc: vscode.TextDocument) {
    this.yText = yText;
    this.doc = doc;
    this.applyingLocalChanges = false;
    this.applyingRemoteChanges = false;
    
    this.yText.observe(
      throttle(async () => {
        vscode.window.showInformationMessage("TEST FROM REMOTE!");
        if (this.applyingLocalChanges) { return; }
        const fullText = this.yText.toString();
        const oldText = this.doc.getText();
        
        if (fullText === oldText) { return; }

        this.applyingRemoteChanges = true;
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
          this.applyingRemoteChanges = false;
        }
      }, 40)
    );
  
    // push local text changes
    vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
      if (this.applyingRemoteChanges) { return; }
      if (this.doc !== event.document) { return; }
      
      this.applyingLocalChanges = true;
      
      vscode.window.showInformationMessage(`Test ${event.document.fileName}`);

      try {
        let changesCopy = [...event.contentChanges];
        this.yText.doc!.transact(() => {
          changesCopy
            .sort((change1, change2) => change2.rangeOffset - change1.rangeOffset)
            .forEach((change) => {
              this.yText.delete(change.rangeOffset, change.rangeLength);
              this.yText.insert(change.rangeOffset, change.text);
            });
        });
      } finally {
        this.applyingLocalChanges = false;
      }
    });
  }
}

export class ExtensionState {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  loading: boolean;

  session: Session | null;
  
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


  getWorkspaceType(): WorkspaceType {
    let folders = vscode.workspace.workspaceFolders;
    let editor = vscode.window.activeTextEditor;
  
    if (folders && folders.length > 0) {
      if (folders.length == 1) {
        return WorkspaceType.SingleRootFolder;
      } else {
        return WorkspaceType.MultiRootFolder;
      }
    } else if (!folders && editor) {
      return WorkspaceType.SingleFile;
    } else {
      return WorkspaceType.Empty;
    }
  }

  async test() {
    console.log(this.session?.workspaceMap)
  }

  async getFilesRecursive(rootDir: string, currentDir: string = rootDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const files: WorkspaceItem[] = [];

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = absoluteToRelative(absolutePath, rootDir);

      if (entry.isDirectory()) {
        files.push({
          type: "folder",
          name: entry.name,
          path: relativePath,
          children: [...await this.getFilesRecursive(rootDir, absolutePath)]
        });
      } else {
        files.push({
          type: "file",
          name: entry.name,
          path: relativePath
        });
      }
    }

    return files;
  }

  // https://stackblitz.com/edit/y-quill-doc-list?file=index.ts
  async hostSession() {  
    let folders = vscode.workspace.workspaceFolders;
    let editor = vscode.window.activeTextEditor;
    let workspaceType = this.getWorkspaceType();

    console.log(WorkspaceType[workspaceType]);
    
    let fileDirs = [];
    switch (workspaceType) {
      case WorkspaceType.Empty:
        // todo: open file browser instead?
        vscode.window.showInformationMessage("Open a file or folder to start collaborating!")
        return;
      case WorkspaceType.SingleFile:
        // todo: get file name from path
        // then create a Yjs document
        break;
      case WorkspaceType.SingleRootFolder:
        const rootPath = folders![0].uri.fsPath;

        let files = await this.getFilesRecursive(rootPath);
        
        // let roomCode = this.generateRoomCode();
        const roomCode = "dev-collab";
        this.session = new Session(roomCode, rootPath);

        for (const file of files) {
          await this.session.bindDocument(file);
        }

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

        break;
      case WorkspaceType.MultiRootFolder:
        vscode.window.showInformationMessage("Sorry, multi-rooted workspaces are not supported. Please open a file or folder to start collaborating.")
        return;
    }
  }

  async joinSession() {
    if (this.session !== null) {
      vscode.window.showErrorMessage("You are already in a collaboration session.");
      return;
    }

    let folders = vscode.workspace.workspaceFolders;
    let editor = vscode.window.activeTextEditor;
    let workspaceType = this.getWorkspaceType();

    // todo: fix whatever this is
    if (workspaceType !== WorkspaceType.SingleRootFolder || !(await isDirectoryEmpty(folders![0].uri))) {
      vscode.window.showInformationMessage("Open an empty folder to join a session.")
      return;
    }

    const targetDir = folders![0].uri;

    this.loading = true;
    this._onDidChange.fire();

    // const roomCode = await vscode.window.showInputBox({
    //   prompt: "Enter the room code for the collaboration session you want to join",
    //   placeHolder: "Room Code"
    // });
    // if (!roomCode) {
    //   vscode.window.showInformationMessage(
    //     "Collaboration cancelled (no room name)."
    //   );
    //   this.loading = false;
    //   this._onDidChange.fire();
    //   return;
    // }
    const roomCode = "dev-collab";

    // const targetDirSelected = await vscode.window.showOpenDialog({
    //   canSelectFiles: false,
    //   canSelectFolders: true,
    //   canSelectMany: false,
    //   openLabel: "Select the folder for your collaboration session"
    // });
    // if (!targetDirSelected || targetDirSelected.length != 1) {
    //   vscode.window.showInformationMessage("Cancelled joining collaboration session.");    
    //   this.loading = false;
    //   this._onDidChange.fire();
    //   return;
    // }
    
    // const targetDir = targetDirSelected[0];

    // await vscode.commands.executeCommand(
    //   "vscode.openFolder",
    //   targetDir
    // );


    this.session = new Session(roomCode, targetDir.fsPath);

    console.log(this.session);
    console.log(this.session.workspaceMap);
    
    this.session.workspaceMap.observe(async () => {
      // setup

      for (const [fileRelPath, yText] of this.session!.workspaceMap.entries()) {
        console.log(fileRelPath, yText);

        await this.session!.createFile(fileRelPath);

        const filePath = vscode.Uri.file(relativeToAbsolute(fileRelPath, this.session!.rootPath));
        const doc = await vscode.workspace.openTextDocument(filePath);
        
        const binding = new DocumentBinding(yText, doc);
      }
    })

    this.loading = false;
    this._onDidChange.fire();
  }

  endSession() {
    this.session?.provider.disconnect();

    this.dispose();
    this.session = null;
    this._onDidChange.fire();
  }

  disconnectSession() {
    
  }

  handleUndo() {
  }
  
  handleRedo() {
  }
}

