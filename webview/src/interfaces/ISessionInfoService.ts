import type { Event } from "../utilities/EventEmitter.js";
import type { SessionInfoPayload } from "../../../shared/models/webview-messages/SessionInfoUpdateEvent.js";

export interface ISessionInfoService {
    readonly onSessionInfoDidChange: Event<SessionInfoPayload>;
    endSession(): Promise<void>;
    copyRoomCode(): Promise<void>;
    toggleFollow(clientId: number): Promise<void>;
    getSessionInfo(): SessionInfoPayload | null;
}
