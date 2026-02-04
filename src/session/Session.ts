import * as Y from "yjs";
import * as vscode from "vscode";

import { Awareness } from "y-protocols/awareness.js";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { ParticipantType } from "../enums/ParticipantType.js";

export class Session {
    roomCode: string;
    doc: Y.Doc;
    provider: HocuspocusProvider;
    awareness: Awareness;
    rootPath: string;
    onChange: vscode.EventEmitter<void>;
    connected: boolean;
    participantType: ParticipantType;
    onHostDisconnect?: () => void;

    constructor(
        roomCode: string,
        rootPath: string,
        onChange: vscode.EventEmitter<void>,
        type: ParticipantType
    ) {
        this.roomCode = roomCode;
        this.doc = new Y.Doc();
        this.provider = new HocuspocusProvider({
            url: "wss://collab.boat-sirapob.com",
            name: roomCode,
            document: this.doc,
        });
        this.awareness = this.provider.awareness!;
        this.rootPath = rootPath;
        this.onChange = onChange;
        this.connected = false;
        this.participantType = type;

        this.provider.on(
            "status",
            ({
                status,
            }: {
                status: "connected" | "disconnected" | "connecting";
            }) => {
                this.connected = status === "connected";
            }
        );
    }

    updateSidebar() {
        this.onChange.fire();
    }

    static generateRoomCode(length = 6) {
        const chars = "1234567890";
        let code = "";
        for (let i = 0; i < length; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    static async hostSession(
        rootPath: string,
        username: string,
        sidebarUpdateCallback: vscode.EventEmitter<void>,
        singleFilePath?: string
    ): Promise<Session> {
        const roomCode = Session.generateRoomCode();

        let session = new Session(
            roomCode,
            rootPath,
            sidebarUpdateCallback,
            "Host"
        );

        return session;
    }

    static async joinSession(
        roomCode: string,
        rootPath: string,
        username: string,
        sidebarUpdateCallback: vscode.EventEmitter<void>
    ): Promise<Session> {
        let session = new Session(
            roomCode,
            rootPath,
            sidebarUpdateCallback,
            "Guest"
        );

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

    async waitForConnection(timeoutMs = 5000): Promise<"connected"> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error("timeout"));
            }, timeoutMs);

            const onStatus = ({
                status,
            }: {
                status: "connected" | "disconnected" | "connecting";
            }) => {
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
        this.provider.disconnect();
    }
}
