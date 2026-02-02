import type { ChatMessage } from "../models/ChatHistoryItem";

export interface IMessageService {
    request(method: "GET" | "POST", endpoint: string, data?: any): Promise<any>;
    get<T>(endpoint: string): Promise<T>;
    post<T>(endpoint: string, data: any): Promise<T>;
    getChatMessages(): Promise<ChatMessage[]>;
}
