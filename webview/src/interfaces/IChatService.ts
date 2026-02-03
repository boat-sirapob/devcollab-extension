import type { ChatMessage } from "../models/ChatHistoryItem";

export interface IChatService {
    sendChatMessage(message: string): void;
}
