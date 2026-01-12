import * as Y from "yjs";
import * as path from "path";
import * as vscode from "vscode";

import { absoluteToRelative, relativeToAbsolute } from "./helpers/utilities.js";

import { Awareness } from "y-protocols/awareness.js";
import { DocumentBinding } from "./DocumentBinding.js";
import { SessionParticipant } from "./models/SessionParticipant.js";
import { WebsocketProvider } from "y-websocket";
import { WorkspaceItem } from "./models/WorkspaceItem.js";
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
  provider: WebsocketProvider;
  awareness: Awareness;
  rootPath: string;
  onChange: vscode.EventEmitter<void>
  connected: boolean;

  constructor(roomCode: string, rootPath: string, onChange: vscode.EventEmitter<void>) {
    this.roomCode = roomCode;
    this.participants = [];
    this.doc = new Y.Doc();
    this.provider = new WebsocketProvider("ws://localhost:1234", roomCode, this.doc);
    this.workspaceMap = this.doc.getMap<Y.Text>("workspace-map");
    this.awareness = this.provider.awareness;
    this.rootPath = rootPath;
    this.onChange = onChange;
    this.connected = false;


    this.awareness.on("change", ({added, updated, removed}: { added: Array<number>, updated: Array<number>, removed: Array<number> }) => {   
      const allStates = this.awareness.getStates();
  
      added.forEach(id => {
        const state = allStates.get(id);
        const user = state?.user;
        if (!user) { return; }
        vscode.window.showInformationMessage(`User joined: ${user?.name ?? id}`);
        this.participants.push({
          clientId: id,
          displayName: user.name,
          color: user.color,
          type: user.type,
        })
        this.onChange.fire();
      });
  
      removed.forEach(id => {
        this.participants = this.participants.filter(
          p => p.clientId !== id
        );
  
        this.onChange.fire();
      });
    });
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
    const filePath = vscode.Uri.file(relativeToAbsolute(relPath, this.rootPath));
    const doc = await vscode.workspace.openTextDocument(filePath);
    
    const binding = new DocumentBinding(yText, doc, this.rootPath, this.awareness);
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

  static async hostSession(rootPath: string, username: string, sidebarUpdateCallback: vscode.EventEmitter<void>): Promise<Session> {
    
    const roomCode = Session.generateRoomCode();

    let session = new Session(roomCode, rootPath, sidebarUpdateCallback);

    let userColor = usercolors[Math.floor(Math.random() * usercolors.length)];
    let user: SessionParticipant = {
      clientId: session.awareness.clientID,
      displayName: username,
      color: userColor,
      type: "Host",
    }

    session.participants.push(user);
    
    session.awareness.setLocalStateField("user", {
      name: user.displayName,
      color: user.color,
      type: user.type,
    });

    let files = await session.getFiles();
    
    for (const file of files) {
      let yText = new Y.Text();
      await session.bindDocument(file.path, yText);
      session.workspaceMap.set(file.path, yText);
    }

    return session
  }

  static async joinSession(roomCode: string, rootPath: string, username: string, sidebarUpdateCallback: vscode.EventEmitter<void>): Promise<Session> {
    let session = new Session(roomCode, rootPath, sidebarUpdateCallback);

    let userColor = usercolors[Math.floor(Math.random() * usercolors.length)];
    let user: SessionParticipant = {
      clientId: session.awareness.clientID,
      displayName: username,
      color: userColor,
      type: "Guest",
    }

    session.participants.push(user);
    
    session.awareness.setLocalStateField("user", {
      name: user.displayName,
      color: user.color,
      type: user.type,
    });

    session.workspaceMap.observe(async () => {
      // setup

      for (const [fileRelPath, yText] of session.workspaceMap.entries()) {
        await session.createFile(fileRelPath);
        await session.bindDocument(fileRelPath, yText);
      }
    });

    return session;
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
}