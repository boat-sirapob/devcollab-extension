import * as vscode from "vscode";
import { ChatHistoryItem } from "../../shared/models/ChatHistoryItem.js";

export interface IChatService {
    readonly onChatHistoryDidChange: vscode.Event<void>;

    get chatHistory(): ChatHistoryItem[];

    sendChatMessage(message: string): void;
}
