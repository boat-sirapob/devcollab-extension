import * as Y from "yjs";
import * as path from "path";
import * as vscode from "vscode";

import { absoluteToRelative, relativeToAbsolute } from "../helpers/Utilities.js";

import { Awareness } from "y-protocols/awareness.js";
import { DocumentBinding } from "./DocumentBinding.js";
import { HocuspocusProvider } from '@hocuspocus/provider'
import { Mapper } from "../helpers/Mapper.js";
import { SessionParticipant } from "../models/SessionParticipant.js";
import { SessionParticipantDto } from "../dto/SessionParticipantDto.js";
import { WorkspaceItem } from "../models/WorkspaceItem.js";
import { readdir } from "fs/promises";

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

export class Session {
  roomCode: string;
  participants: SessionParticipant[];
  doc: Y.Doc;
  workspaceMap: Y.Map<Y.Text>
  provider: HocuspocusProvider;
  awareness: Awareness;
  rootPath: string;
  onChange: vscode.EventEmitter<void>
  connected: boolean;
  onHostDisconnect?: () => void;

  bindings: Map<string, DocumentBinding>;
  fileSystemWatcher?: vscode.FileSystemWatcher;
  isApplyingRemoteChange: boolean;

  constructor(roomCode: string, rootPath: string, onChange: vscode.EventEmitter<void>) {
    this.roomCode = roomCode;
    this.participants = [];
    this.doc = new Y.Doc();
    this.provider = new HocuspocusProvider({
      url: "wss://collab.boat-sirapob.com",
      name: roomCode,
      document: this.doc
    });
    this.workspaceMap = this.doc.getMap<Y.Text>("workspace-map");
    this.awareness = this.provider.awareness!;
    this.rootPath = rootPath;
    this.onChange = onChange;
    this.connected = false;
    this.isApplyingRemoteChange = false;

    this.bindings = new Map();

    this.provider.on("status", ({ status }: { status: "connected" | "disconnected" | "connecting" })  => {
      this.connected = status === "connected";
    });

    this.setupAwareness();
    this.setupFileChangeHandling(); 
  }

  updateSidebar() {
    this.onChange.fire();
  }

  setupAwareness() {
    this.awareness.on("change", ({added, updated, removed}: { added: Array<number>, updated: Array<number>, removed: Array<number> }) => {   
      const allStates = this.awareness.getStates();
  
      added.forEach(id => {
        const state = allStates.get(id);
        const user: SessionParticipantDto = state?.user;
        if (!user) { return; }

        vscode.window.showInformationMessage(`User joined: ${user?.displayName ?? id}`);
        
        let sessionUser = Mapper.fromSessionParticipantDto(user, id);
        this.participants.push(sessionUser);
        this.updateSidebar();
      });
  
      removed.forEach(id => {
        this.participants = this.participants.filter(p => p.clientId !== id);
        this.updateSidebar();
      });

      if (updated.length > 0) {
        this.updateSidebar();
      }

      // todo: make this a message from the server
      // disconnect on session end
      let hostPresent = false;
      for (const [, state] of allStates) {
        const user = (state as any).user;
        if (user?.type === "Host") {
          hostPresent = true;
          break;
        }
      }
      
      if (!hostPresent && this.connected) {
        vscode.window.showInformationMessage("Host has ended the session. Disconnecting...");
        this.provider.disconnect();
        this.onHostDisconnect?.();
      }
    });
  }

  setupFileChangeHandling() {
    this.workspaceMap.observe(this.fileChangeHandler);
    this.setupFileWatcher();
  }

  setupFileWatcher() {
    const pattern = new vscode.RelativePattern(this.rootPath, '**');
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
          const fileUri = vscode.Uri.file(relativeToAbsolute(key, this.rootPath));
          try {
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
  }

  static generateRoomCode(length = 6) {
    const chars = "1234567890";
    let code = "";
    for (let i = 0; i < length; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async getFiles(currentDir: string = this.rootPath) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const files: WorkspaceItem[] = [];
    
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = absoluteToRelative(absolutePath, this.rootPath);

      if (entry.isDirectory()) {
        files.push(...await this.getFiles(absolutePath));
      } else {
        files.push({
          name: entry.name,
          path: relativePath
        });
      }
    }
    
    return files;
  }

  async bindDocument(relPath: string, yText: Y.Text) {
    const oldBinding = this.bindings.get(relPath);
    if (oldBinding) {
      oldBinding.dispose();
    }

    const filePath = vscode.Uri.file(relativeToAbsolute(relPath, this.rootPath));
    const doc = await vscode.workspace.openTextDocument(filePath);
    
    const binding = new DocumentBinding(yText, doc, this.rootPath, this.awareness);
    this.bindings.set(relPath, binding);
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

  addParticipant(participant: SessionParticipant) {
    this.participants.push(participant);
  }

  initializeUser(username: string, userType: "Host" | "Guest") {    
    let userColor = usercolors[Math.floor(Math.random() * usercolors.length)];
    let user: SessionParticipant = {
      clientId: this.awareness.clientID,
      displayName: username,
      color: userColor,
      type: userType,
    }

    this.participants.push(user);
    
    let awarenessUser = Mapper.toSessionParticipantDto(user);
    this.awareness.setLocalStateField("user", awarenessUser);
  }

  static async hostSession(rootPath: string, username: string, sidebarUpdateCallback: vscode.EventEmitter<void>, singleFilePath?: string): Promise<Session> {
    
    const roomCode = Session.generateRoomCode();

    let session = new Session(roomCode, rootPath, sidebarUpdateCallback);
    session.initializeUser(username, "Host");

    let files;

    if (singleFilePath) {
      const rel = absoluteToRelative(singleFilePath, rootPath);
      files = [{ name: path.basename(singleFilePath), path: rel }];
    } else {
      files = await session.getFiles();
    }
    
    for (const file of files) {
      let yText = new Y.Text();
      session.workspaceMap.set(file.path, yText);
      await session.bindDocument(file.path, yText);
    }
    
    return session
  }

  static async joinSession(roomCode: string, rootPath: string, username: string, sidebarUpdateCallback: vscode.EventEmitter<void>): Promise<Session> {
    let session = new Session(roomCode, rootPath, sidebarUpdateCallback);
    session.initializeUser(username, "Guest");

    return session;
  }

  async waitForHost(timeoutMs = 2000): Promise<boolean> {
    const checkForHost = () => {
      const allStates = this.awareness.getStates();
      for (const [, state] of allStates) {
        const user = (state as any).user;
        if (user?.type === "Host") {
          return true;
        }
      }
      return false;
    };

    if (checkForHost()) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);

      const onChange = () => {
        if (checkForHost()) {
          cleanup();
          resolve(true);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.awareness.off("change", onChange);
      };

      this.awareness.on("change", onChange);
    });
  }

  async waitForConnection(
    timeoutMs = 5000
  ): Promise<"connected"> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("timeout"));
      }, timeoutMs);

      const onStatus = ({ status }: { status: "connected" | "disconnected" | "connecting" }) => {
        if (status === "connected") {
          cleanup();
          resolve("connected");
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.provider.off("status", onStatus);
      };

      this.provider.on("status", onStatus);
    });
  }

  dispose() {
    for (const binding of this.bindings.values()) {
      binding.dispose();
    }
    this.bindings.clear();

    if (this.fileSystemWatcher) {
      this.fileSystemWatcher.dispose();
    }

    this.provider.disconnect();
  }
}