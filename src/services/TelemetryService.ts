import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { inject, injectable } from "tsyringe";

import { ITelemetryService } from "../interfaces/ITelemetryService.js";
import { SessionInfo } from "../session/SessionInfo.js";
import { Session } from "../session/Session.js";
import { AwarenessState } from "../models/AwarenessState.js";
import { SessionInfoWebviewProvider } from "../ui/session-info-webview/SessionInfoWebviewProvider.js";

const IDLE_THRESHOLD_MS = 20_000; // 20s of no activity = idle

type TelemetryEventType =
    | "session_started"
    | "session_ended"
    | "guest_join"
    | "guest_disconnect"
    | "first_edit"
    | "session_summary"
    | "copy_room_code"
    | "follow"
    | "unfollow"
    | "share_terminal"
    | "join_terminal"
    | "close_terminal"
    | "share_server"
    | "join_server"
    | "close_server"
    | "chat_sent"
    | "edit_operation"
    | "undo"
    | "redo"
    | "file_switch"
    | "sidebar_open"
    | "sidebar_close";

interface TelemetryPayload {
    eventType: TelemetryEventType;
    timestamp: string;
    roomCode: string;
    participantType: string;
    username: string;
    [key: string]: unknown; // allow extra fields for summary
}

interface TelemetrySessionSummary extends Record<string, unknown> {
    totalEdits: number;
    cursorMoves: number;
    fileSwitches: number;
    tabSwitches: number;
    sessionDurationMs: number;
    idleTimeMs: number;
    sidebarTimeMs: number;
    followTimeMs: number;
    sharedTerminalTimeMs: number;
    sharedServerTimeMs: number;
    chatMessagesSent: number;
    undoCount: number;
    redoCount: number;
}

@injectable()
export class TelemetryService implements ITelemetryService {
    private editCount = 0;
    private cursorMoveCount = 0;
    private fileSwitchCount = 0;
    private tabSwitchCount = 0;

    private sessionStartTime = Date.now();
    private lastActivityTime = Date.now();
    private totalIdleMs = 0;
    private hasSentFirstEdit = false;

    private sidebarTimeMs = 0;
    private sidebarEnteredAt: number | null = null;
    private followTimeMs = 0;
    private followStartedAt: number | null = null;

    private sharedTerminalTimeMs = 0;
    private terminalJoinedAt: number | null = null;
    private sharedServerTimeMs = 0;
    private serverJoinedAt: number | null = null;

    private chatMessagesSent = 0;
    private undoCount = 0;
    private redoCount = 0;

    private disposables: vscode.Disposable[] = [];
    private logFilePath: string;

    constructor(
        @inject("Session") private session: Session,
        @inject("SessionInfo") private sessionInfo: SessionInfo,
        @inject("SessionInfoWebviewProvider") private sidebarProvider: SessionInfoWebviewProvider,
        @inject("ExtensionContext") private context: vscode.ExtensionContext
    ) {
        // Ensure storage directory exists and set up log file
        const storageDir = this.context.globalStorageUri.fsPath;
        fs.mkdirSync(storageDir, { recursive: true });
        this.logFilePath = path.join(storageDir, "telemetry.jsonl");

        const awarenessHandler = ({
            added,
            removed,
        }: {
            added: number[];
            updated: number[];
            removed: number[];
        }) => {
            const states = this.session.awareness.getStates();

            for (const id of added) {
                if (id === this.session.awareness.clientID) {
                    continue;
                }
                const state = states.get(id) as AwarenessState | undefined;
                const name = state?.user?.displayName ?? String(id);
                this.postEvent("guest_join", { guestName: name, guestClientId: id });
            }

            for (const id of removed) {
                if (id === this.session.awareness.clientID) {
                    continue;
                }
                this.postEvent("guest_disconnect", { guestClientId: id });
            }
        };
        this.session.awareness.on("change", awarenessHandler);
        this.disposables.push({ dispose: () => this.session.awareness.off("change", awarenessHandler) });

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                this.fileSwitchCount++;
                this.markActivity();
                if (editor) {
                    this.postEvent("file_switch", { fileName: vscode.workspace.asRelativePath(editor.document.uri) });
                }
            })
        );

        // Track time spent in the extension sidebar using view visibility
        if (this.sidebarProvider.isViewVisible) {
            this.sidebarEnteredAt = Date.now();
        }
        this.disposables.push(
            this.sidebarProvider.onDidChangeViewVisibility((visible) => {
                if (visible) {
                    if (this.sidebarEnteredAt === null) {
                        this.sidebarEnteredAt = Date.now();
                    }
                    this.postEvent("sidebar_open");
                } else {
                    if (this.sidebarEnteredAt !== null) {
                        this.sidebarTimeMs += Date.now() - this.sidebarEnteredAt;
                        this.sidebarEnteredAt = null;
                    }
                    this.postEvent("sidebar_close");
                }
            })
        );

        this.disposables.push(
            vscode.window.onDidChangeWindowState((state) => {
                this.tabSwitchCount++;
                if (state.focused) {
                    this.markActivity();
                }
            })
        );

        this.postEvent("session_started");
    }

    recordEdit(): void {
        this.editCount++;
        this.markActivity();

        if (!this.hasSentFirstEdit) {
            this.hasSentFirstEdit = true;
            this.postEvent("first_edit");
        }

        this.postEvent("edit_operation");
    }

    recordCursorMove(): void {
        this.cursorMoveCount++;
        this.markActivity();
    }

    recordAction(action: string, extra: Record<string, unknown> = {}): void {
        this.markActivity();

        if (action === "follow") {
            this.followStartedAt = Date.now();
        } else if (action === "unfollow") {
            if (this.followStartedAt !== null) {
                this.followTimeMs += Date.now() - this.followStartedAt;
                this.followStartedAt = null;
            }
        }

        if (action === "share_terminal" || action === "join_terminal") {
            this.terminalJoinedAt = Date.now();
        } else if (action === "close_terminal") {
            if (this.terminalJoinedAt !== null) {
                this.sharedTerminalTimeMs += Date.now() - this.terminalJoinedAt;
                this.terminalJoinedAt = null;
            }
        }

        if (action === "share_server" || action === "join_server") {
            this.serverJoinedAt = Date.now();
        } else if (action === "close_server") {
            if (this.serverJoinedAt !== null) {
                this.sharedServerTimeMs += Date.now() - this.serverJoinedAt;
                this.serverJoinedAt = null;
            }
        }

        if (action === "chat_sent") {
            this.chatMessagesSent++;
        }

        if (action === "undo") {
            this.undoCount++;
        } else if (action === "redo") {
            this.redoCount++;
        }

        this.postEvent(action as TelemetryEventType, extra);
    }

    dispose(): void {
        this.markActivity();

        if (this.sidebarEnteredAt !== null) {
            this.sidebarTimeMs += Date.now() - this.sidebarEnteredAt;
            this.sidebarEnteredAt = null;
        }

        if (this.followStartedAt !== null) {
            this.followTimeMs += Date.now() - this.followStartedAt;
            this.followStartedAt = null;
        }

        if (this.terminalJoinedAt !== null) {
            this.sharedTerminalTimeMs += Date.now() - this.terminalJoinedAt;
            this.terminalJoinedAt = null;
        }

        if (this.serverJoinedAt !== null) {
            this.sharedServerTimeMs += Date.now() - this.serverJoinedAt;
            this.serverJoinedAt = null;
        }

        const sessionDurationMs = Date.now() - this.sessionStartTime;

        const summary: TelemetrySessionSummary = {
            totalEdits: this.editCount,
            cursorMoves: this.cursorMoveCount,
            fileSwitches: this.fileSwitchCount,
            tabSwitches: this.tabSwitchCount,
            sessionDurationMs,
            idleTimeMs: this.totalIdleMs,
            sidebarTimeMs: this.sidebarTimeMs,
            followTimeMs: this.followTimeMs,
            sharedTerminalTimeMs: this.sharedTerminalTimeMs,
            sharedServerTimeMs: this.sharedServerTimeMs,
            chatMessagesSent: this.chatMessagesSent,
            undoCount: this.undoCount,
            redoCount: this.redoCount,
        };
        this.postEvent("session_summary", summary);

        this.postEvent("session_ended");

        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables = [];
    }

    private markActivity(): void {
        const now = Date.now();
        const gap = now - this.lastActivityTime;
        if (gap > IDLE_THRESHOLD_MS) {
            this.totalIdleMs += gap;
        }
        this.lastActivityTime = now;
    }

    private postEvent(
        eventType: TelemetryEventType,
        extra: Record<string, unknown> = {}
    ): void {
        const payload: TelemetryPayload = {
            eventType,
            timestamp: new Date().toISOString(),
            roomCode: this.session.roomCode,
            participantType: this.sessionInfo.participantType,
            username: this.sessionInfo.username,
            ...extra,
        };

        try {
            fs.appendFileSync(this.logFilePath, JSON.stringify(payload) + "\n");
        } catch (err) {
            console.warn("[telemetry] Failed to write event to log file", eventType, err);
        }

        // // POST to server
        // const baseUrl = Config.getHttpServerUrl().replace(/\/$/, "");
        // const endpoint = `${baseUrl}/telemetry/session`;
        // try {
        //     await fetch(endpoint, {
        //         method: "POST",
        //         headers: { "Content-Type": "application/json" },
        //         body: JSON.stringify(payload),
        //     });
        // } catch (err) {
        //     console.warn("[telemetry] Failed to send event", eventType, err);
        // }
    }
}