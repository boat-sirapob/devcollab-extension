import type {
    ChatHistoryTimelineItem,
    ChatMessage,
} from "../models/ChatHistoryItem.js";
import { container, inject, injectable } from "tsyringe";

import { BeginSessionMessage } from "../../../shared/models/webview-messages/BeginSessionMessage.js";
import { IChatService } from "../interfaces/IChatService.js";
import type { IMessageService } from "../interfaces/IMessageService.js";
import { SendChatEvent } from "../../../shared/models/webview-messages/SendChatEvent.js";
import { SessionParticipant } from "../../../shared/models/SessionParticipant.js";
import { WebviewMessageBase } from "../../../shared/models/webview-messages/WebviewMessageBase.js";
import { WebviewMessageType } from "../../../shared/enums/WebviewMessageType.js";
import { vscode } from "../utilities/vscode.js";

@injectable()
export class ChatService implements IChatService {
    chatHistory: (ChatMessage | ChatHistoryTimelineItem)[] = [];
    isInSession: boolean = false;
    currentUser: SessionParticipant | null = null;

    constructor(
        @inject("IMessageService") private messageService: IMessageService
    ) {
        console.log("ChatService initialized");
        window.addEventListener("message", this.handleMessageReceived);
    }

    handleMessageReceived = (event: MessageEvent) => {
        const data: WebviewMessageBase = event.data;
        switch (data.type) {
            case WebviewMessageType.BEGIN_SESSION:
                this.handleBeginSessionMessage(data as BeginSessionMessage);
                break;
            case WebviewMessageType.CHAT_MESSAGE:
                this.handleChatMessage(data);
                break;
        }
    };

    handleBeginSessionMessage = (data: BeginSessionMessage) => {
        console.log("ChatService received begin session message:", data);

        this.isInSession = true;
        this.currentUser = data.user;
    };

    sendChatMessage(message: string): void {
        console.log("sending message:", message);

        let chatMessage: SendChatEvent = {
            type: WebviewMessageType.CHAT_MESSAGE,
            message: message,
            timestamp: new Date(),
        };

        vscode.postMessage(chatMessage);
    }

    handleChatMessage = (data: WebviewMessageBase) => {

    };
}

export function useChatService(): IChatService {
    return container.resolve<IChatService>("IChatService");
}
