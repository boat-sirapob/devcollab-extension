
import { container, inject, injectable } from "tsyringe";

import { BeginSessionMessage } from "../../../shared/models/webview-messages/BeginSessionMessage.js";
import { IChatService } from "../interfaces/IChatService.js";
import type { IMessageService } from "../interfaces/IMessageService.js";
import { SendChatEvent } from "../../../shared/models/webview-messages/SendChatEvent.js";
import { SessionParticipant } from "../../../shared/models/SessionParticipant.js";
import { WebviewMessageBase } from "../../../shared/models/webview-messages/WebviewMessageBase.js";
import { UpdateChatHistoryEvent } from "../../../shared/models/webview-messages/UpdateChatHistoryEvent.js";
import { WebviewMessageType } from "../../../shared/enums/WebviewMessageType.js";
import { ChatHistoryItem } from "../../../shared/models/ChatHistoryItem.js";
import { Mapper } from "../../../shared/helpers/Mapper.js";
import { vscode } from "../utilities/vscode.js";
import { EventEmitter, type Event } from "../utilities/EventEmitter.js";

@injectable()
export class ChatService implements IChatService {
    chatHistory: ChatHistoryItem[] = [];
    isInSession: boolean = false;
    currentUser: SessionParticipant | null = null;
    private _onDidChangeHistory = new EventEmitter<ChatHistoryItem[]>();
    readonly onDidChangeHistory: Event<ChatHistoryItem[]> = this._onDidChangeHistory.event;

    constructor(
        @inject("IMessageService") private messageService: IMessageService
    ) {
        window.addEventListener("message", this.handleMessageReceived);
    }

    handleMessageReceived = (event: MessageEvent) => {
        console.log("5.5 webview chatservice handleMessageReceived received message:", event.data);
        const data: WebviewMessageBase = event.data;
        switch (data.type) {
            case WebviewMessageType.BEGIN_SESSION:
                this.handleBeginSessionMessage(data as BeginSessionMessage);
                break;
            case WebviewMessageType.UPDATE_CHAT_HISTORY:
                this.handleUpdateChatHistory(data as UpdateChatHistoryEvent);
                break;
        }
    };

    handleBeginSessionMessage = (data: BeginSessionMessage) => {
        this.isInSession = true;
        this.currentUser = data.user;
        console.log(this.currentUser)
    };

    handleUpdateChatHistory(data: UpdateChatHistoryEvent) {
        console.log("6. webview chatservice handleUpdateChatHistory received update:", data.updated_history);
        this.chatHistory = data.updated_history.map(Mapper.fromChatHistoryItemDto);
        this._onDidChangeHistory.fire([...this.chatHistory]);
    }

    sendChatMessage(message: string): void {
        let chatMessage: SendChatEvent = {
            type: WebviewMessageType.CHAT_MESSAGE,
            message: message,
            timestamp: new Date(),
        };

        vscode.postMessage(chatMessage);
    }

    getChatHistory(): ChatHistoryItem[] {
        return [...this.chatHistory];
    }
}

export function useChatService(): IChatService {
    return container.resolve<IChatService>("IChatService");
}
