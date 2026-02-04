import * as vscode from "vscode";

import { InjectionToken } from "tsyringe";
import { Session } from "../session/Session.js";

export interface ISessionService {
    session: Session | null;
    loading: boolean;
    tempDir: string | null;
    onDidChange: vscode.Event<void>;
    onBeginSession: vscode.Event<void>;

    initializeSessionContainer(): void;
    disposeSessionContainer(): void;
    get<T>(token: InjectionToken<T>): T;
    hasSession(): boolean;

    cleanupOldTempDirs(): void;
    restorePendingSession(): Promise<void>;
    copyRoomCode(roomCode?: string): Promise<void>;
    hostSession(): Promise<void>;
    joinSession(): Promise<void>;
    endSession(): Promise<void>;
    closeSession(): Promise<void>;
    disconnectSession(): Promise<void>;
    closeLocalSession(): Promise<void>;
    dispose(): void;
}
