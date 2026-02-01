import * as vscode from "vscode";

import { Session } from "../session/Session.js";

export interface ISessionService {
    session: Session | null;
    loading: boolean;
    tempDir: string | null;
    onDidChange: vscode.Event<void>;

    setContext(context: vscode.ExtensionContext): void;
    cleanupOldTempDirs(): void;
    restorePendingSession(): Promise<void>;
    copyRoomCode(roomCode?: string): Promise<void>;
    hostSession(): Promise<void>;
    joinSession(): Promise<void>;
    endSession(): Promise<void>;
    closeSession(): Promise<void>;
    disconnectSession(): Promise<void>;
    closeLocalSession(): Promise<void>;
    handleUndo(): void;
    handleRedo(): void;
    getSession(): Session | null;
    dispose(): void;
}
