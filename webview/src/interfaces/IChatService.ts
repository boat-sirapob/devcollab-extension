import type { ChatHistoryItem } from "../../../shared/models/ChatHistoryItem";
import type { Event } from "../utilities/EventEmitter.js";

export interface IChatService {
    readonly onDidChangeHistory: Event<ChatHistoryItem[]>;
    sendChatMessage(message: string): void;
    getChatHistory(): ChatHistoryItem[];
}
