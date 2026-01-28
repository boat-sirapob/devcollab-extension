import * as path from "path";
import * as vscode from "vscode";

import { absoluteToRelative, getWorkspaceType, isDirectoryEmpty } from "./helpers/Utilities.js";

import { Session } from "./session/Session.js";
import { WorkspaceType } from "./enums/WorkspaceType.js";

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

  setLoading(val: boolean) {
    this.loading = val;
    this._onDidChange.fire();
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

  async inputUsername(): Promise<string | undefined> {
    return await vscode.window.showInputBox({
      title: "Display name",
      placeHolder: "Enter your display name for this session (empty to cancel)",
    });
  }

  closeLocalSession() {
    this.session?.provider.disconnect();
    this.dispose();
    this.session = null;
    this._onDidChange.fire();
  }

  async test() {
    console.log(this.session?.workspaceMap)
  }

  // https://stackblitz.com/edit/y-quill-doc-list?file=index.ts
  async hostSession() {
    if (this.session !== null) {
      vscode.window.showErrorMessage("You are already in a collaboration session.");
      return;
    }
    
    this.setLoading(true);

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
        this.setLoading(false);
        return;
      case WorkspaceType.SingleFile: {
        if (!editor) {
          vscode.window.showInformationMessage("Open a file to start collaborating!")
          this.setLoading(false);
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
        this.setLoading(false);
        return;
    }

    let username = await this.inputUsername();
    if (!username) { 
      vscode.window.showInformationMessage("Cancelled hosting collaboration session.");    
      this.setLoading(false);
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
          this.closeLocalSession();
        } finally {
          this.setLoading(false);
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

  async joinSession() {
    if (this.session !== null) {
      vscode.window.showErrorMessage("You are already in a collaboration session.");
      return;
    }

    this.setLoading(true);

    let folders = vscode.workspace.workspaceFolders;
    let editor = vscode.window.activeTextEditor;
    let workspaceType = getWorkspaceType();

    // todo: open a temporary folder
    if (workspaceType !== WorkspaceType.SingleRootFolder || !(await isDirectoryEmpty(folders![0].uri))) {
      vscode.window.showInformationMessage("Open an empty folder to join a session.")
      this.setLoading(false);
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
      this.setLoading(false);
      return;
    }

    let username = await this.inputUsername();
    if (!username) { 
      vscode.window.showInformationMessage("Cancelled joining collaboration session.");    
      this.setLoading(false);
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
            this.closeLocalSession();
            return;
          }

          vscode.window.showInformationMessage("Connected to collaboration server");
        } catch {
          vscode.window.showErrorMessage("Unable to connect to collaboration server");
          this.closeLocalSession();
        } finally {
          this.setLoading(false);
        }
      }
    );
  }

  endSession() {
    vscode.window.showInformationMessage("The collaboration session has been ended.");
    this.closeLocalSession();
  }

  disconnectSession() {
    vscode.window.showInformationMessage("You have disconnected from the collaboration session.");
    this.closeLocalSession();
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

