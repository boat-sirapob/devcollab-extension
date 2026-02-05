import type { ChatHistoryItem } from "../../../shared/models/ChatHistoryItem";
import type { Event } from "../utilities/EventEmitter.js";
import { SessionParticipant } from "../../../shared/models/SessionParticipant.js";

export interface IChatService {
    readonly currentUser: SessionParticipant | null;
    readonly onDidChangeHistory: Event<ChatHistoryItem[]>;
    sendChatMessage(message: string): void;
    getChatHistory(): ChatHistoryItem[];
}
