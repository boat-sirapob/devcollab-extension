import { PendingSessionState } from "../models/PendingSessionState.js";

export interface IPersistenceService {
    getPendingSessionState(): PendingSessionState | undefined;
    setPendingSessionState(
        state: PendingSessionState | undefined
    ): Promise<void>;

    getSavedUsername(): string | undefined;
    setSavedUsername(username: string | undefined): Promise<void>;
}
