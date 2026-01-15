import * as path from "path";
import * as vscode from "vscode";

import { absoluteToRelative, getWorkspaceType, isDirectoryEmpty, relativeToAbsolute } from "./helpers/utilities.js";

import { DocumentBinding } from "./DocumentBinding.js";
import { Session } from "./session.js";
import { SessionParticipant } from "./models/SessionParticipant.js";
import { WorkspaceItem } from "./models/WorkspaceItem.js";
import { WorkspaceType } from "./enums/WorkspaceType.js";
import { readdir } from "fs/promises";

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

  async test() {
    console.log(this.session?.workspaceMap)
  }

  // https://stackblitz.com/edit/y-quill-doc-list?file=index.ts
  async hostSession() {
    this.loading = true;
    this._onDidChange.fire();

    let folders = vscode.workspace.workspaceFolders;
    let editor = vscode.window.activeTextEditor;
    let workspaceType = getWorkspaceType();
    
    let targetRootPath: string | undefined;
    let singleFilePath: string | undefined;
    let startedForFileName: string | undefined;

    switch (workspaceType) {
      case WorkspaceType.Empty:
        // todo: open file browser instead?
        vscode.window.showInformationMessage("Open a file or folder to start collaborating!")
        this.loading = false;
        this._onDidChange.fire();
        return;
      case WorkspaceType.SingleFile: {
        if (!editor) {
          vscode.window.showInformationMessage("Open a file to start collaborating!")
          this.loading = false;
          this._onDidChange.fire();
          return;
        }

        singleFilePath = editor.document.uri.fsPath;
        targetRootPath = path.dirname(singleFilePath);
        startedForFileName = path.basename(singleFilePath);

        break;
      }
      case WorkspaceType.SingleRootFolder:
        targetRootPath = folders![0].uri.fsPath;
        break;
      case WorkspaceType.MultiRootFolder:
        vscode.window.showInformationMessage("Sorry, multi-rooted workspaces are not supported. Please open a file or folder to start collaborating.")
        this.loading = false;
        this._onDidChange.fire();
        return;
    }

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

    this.session = await Session.hostSession(targetRootPath!, username, this._onDidChange, singleFilePath);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Connecting to collaboration server",
        cancellable: false,
      },
      async () => {
        try {
          await this.session!.waitForConnection(5000);
        } catch {
          vscode.window.showErrorMessage("Unable to connect to collaboration server");
          this.session!.provider.disconnect();
          this.dispose();
          this.session = null;
        } finally {
          this.loading = false;
          this._onDidChange.fire();
        }
      }
    );
    if (this.session === null) { return; }
    
    const message = startedForFileName
      ? `Collaboration session started for file ${startedForFileName} with room code: ${this.session.roomCode}`
      : `Collaboration session started with room code: ${this.session.roomCode}`;

    vscode.window.showInformationMessage(
      message,
      "Copy code to clipboard",
    ).then(async copy => {
      if (copy) {
        this.copyRoomCode(this.session?.roomCode);
      }
    });
  }

  async copyRoomCode(roomCode?: string) {
    const code = roomCode ?? this.session?.roomCode;
    if (!code) {
      vscode.window.showErrorMessage("No active collaboration session to copy code from.");
      return;
    }
    await vscode.env.clipboard.writeText(code);
    vscode.window.showInformationMessage(`Copied room code ${code} to clipboard!`);
  }

  async joinSession() {
    if (this.session !== null) {
      vscode.window.showErrorMessage("You are already in a collaboration session.");
      return;
    }

    this.loading = true;
    this._onDidChange.fire();

    let folders = vscode.workspace.workspaceFolders;
    let editor = vscode.window.activeTextEditor;
    let workspaceType = getWorkspaceType();

    // todo: open a temporary folder
    if (workspaceType !== WorkspaceType.SingleRootFolder || !(await isDirectoryEmpty(folders![0].uri))) {
      vscode.window.showInformationMessage("Open an empty folder to join a session.")
      this.loading = false;
      this._onDidChange.fire();
      return;
    }

    const targetDir = folders![0].uri;

    const roomCode = await vscode.window.showInputBox({
      prompt: "Enter the room code for the collaboration session you want to join",
      placeHolder: "Room Code"
    });
    if (!roomCode) {
      vscode.window.showInformationMessage(
        "Cancelled joining collaboration session."
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

    this.session = await Session.joinSession(roomCode, targetDir.fsPath, username, this._onDidChange);

    this.session.onHostDisconnect = () => {
      this.disconnectSession();
    };

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Connecting to collaboration server",
        cancellable: false,
      },
      async () => {
        try {
          await this.session!.waitForConnection(5000);
          const hostFound = await this.session!.waitForHost(2000);
          if (!hostFound) {
            vscode.window.showErrorMessage(`A room with the code ${this.session?.roomCode} could not be found.`);
            this.session!.provider.disconnect();
            this.dispose();
            this.session = null;
            return;
          }

          vscode.window.showInformationMessage("Connected to collaboration server");
        } catch {
          vscode.window.showErrorMessage("Unable to connect to collaboration server");
          this.session!.provider.disconnect();
          this.dispose();
          this.session = null;
        } finally {
          this.loading = false;
          this._onDidChange.fire();
        }
      }
    );
  }

  endSession() {
    this.session?.provider.disconnect();

    this.dispose();
    this.session = null;
    this._onDidChange.fire();
  }

  disconnectSession() {
    this.session?.provider.disconnect();
    
    this.dispose();
    this.session = null;
    this._onDidChange.fire();
  }

  handleUndo() {
    const editor = vscode.window.activeTextEditor;

    if (!this.session || !editor) {
      vscode.commands.executeCommand("undo");
      return;
    }

    const relPath = absoluteToRelative(editor.document.uri.fsPath.toString(), this.session.rootPath);
    const binding = this.session.bindings.get(relPath);

    if (binding?.yUndoManager) {
      binding.yUndoManager.undo();
    } else {
      vscode.commands.executeCommand("undo");
    }
  }
  
  handleRedo() {
    const editor = vscode.window.activeTextEditor;

    if (!this.session || !editor) {
      vscode.commands.executeCommand("redo");
      return;
    }

    const relPath = absoluteToRelative(editor.document.uri.fsPath.toString(), this.session.rootPath);
    const binding = this.session.bindings.get(relPath);

    if (binding?.yUndoManager) {
      binding.yUndoManager.redo();
    } else {
      void vscode.commands.executeCommand("redo");
    }
  }
}

