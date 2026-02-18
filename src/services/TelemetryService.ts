import * as vscode from "vscode";
import { inject, injectable } from "tsyringe";

import { Config } from "../config/Config.js";
import { ITelemetryService } from "../interfaces/ITelemetryService.js";
import { SessionInfo } from "../session/SessionInfo.js";
import { Session } from "../session/Session.js";
import { AwarenessState } from "../models/AwarenessState.js";

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
    | "share_server"
    | "join_server";

interface TelemetryPayload {
    eventType: TelemetryEventType;
    timestamp: string;
    roomCode: string;
    participantType: string;
    username: string;
    [key: string]: unknown; // allow extra fields for summary
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

    private disposables: vscode.Disposable[] = [];

    constructor(
        @inject("Session") private session: Session,
        @inject("SessionInfo") private sessionInfo: SessionInfo
    ) {
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
                void this.postEvent("guest_join", { guestName: name, guestClientId: id });
            }

            for (const id of removed) {
                if (id === this.session.awareness.clientID) {
                    continue;
                }
                void this.postEvent("guest_disconnect", { guestClientId: id });
            }
        };
        this.session.awareness.on("change", awarenessHandler);
        this.disposables.push({ dispose: () => this.session.awareness.off("change", awarenessHandler) });

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => {
                this.fileSwitchCount++;
                this.markActivity();
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

        void this.postEvent("session_started");
    }

    recordEdit(): void {
        this.editCount++;
        this.markActivity();

        if (!this.hasSentFirstEdit) {
            this.hasSentFirstEdit = true;
            void this.postEvent("first_edit");
        }
    }

    recordCursorMove(): void {
        this.cursorMoveCount++;
        this.markActivity();
    }

    recordAction(action: string, extra: Record<string, unknown> = {}): void {
        this.markActivity();
        void this.postEvent(action as TelemetryEventType, extra);
    }

    dispose(): void {
        // Account for any trailing idle time
        this.markActivity();

        const sessionDurationMs = Date.now() - this.sessionStartTime;

        void this.postEvent("session_summary", {
            totalEdits: this.editCount,
            cursorMoves: this.cursorMoveCount,
            fileSwitches: this.fileSwitchCount,
            tabSwitches: this.tabSwitchCount,
            sessionDurationMs,
            idleTimeMs: this.totalIdleMs,
        });

        void this.postEvent("session_ended");

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

    private async postEvent(
        eventType: TelemetryEventType,
        extra: Record<string, unknown> = {}
    ): Promise<void> {
        const baseUrl = Config.getHttpServerUrl().replace(/\/$/, "");
        const endpoint = `${baseUrl}/telemetry/session`;

        const payload: TelemetryPayload = {
            eventType,
            timestamp: new Date().toISOString(),
            roomCode: this.session.roomCode,
            participantType: this.sessionInfo.participantType,
            username: this.sessionInfo.username,
            ...extra,
        };

        try {
            await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        } catch (err) {
            console.warn("[telemetry] Failed to send event", eventType, err);
        }
    }
}