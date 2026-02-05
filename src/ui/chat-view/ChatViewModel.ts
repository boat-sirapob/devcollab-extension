import * as vscode from "vscode";

import { IAwarenessService } from "../../interfaces/IAwarenessService.js";
import { IChatService } from "../../interfaces/IChatService.js";
import { UpdateChatHistoryEvent } from "../../../shared/models/webview-messages/UpdateChatHistoryEvent.js";
import { WebviewMessageType } from "../../../shared/enums/WebviewMessageType.js";
import { inject, injectable } from "tsyringe";
import { BeginSessionMessage } from "../../../shared/models/webview-messages/BeginSessionMessage.js";
import { ChatHistoryItem, ChatHistoryItemType, ChatTimelineItemType } from "../../../shared/models/ChatHistoryItem.js";
import { ChatHistoryItemDto } from "../../../shared/dtos/ChatHistoryItemDto.js";
import { Mapper } from "../../../shared/helpers/Mapper.js";

@injectable()
export class ChatViewModel {
    private readonly disposables: vscode.Disposable[] = [];

    constructor(
        @inject("IChatService") private chatService: IChatService,
        @inject("IAwarenessService") private awarenessService: IAwarenessService
    ) { }

    bind(postMessage: (msg: any) => void): void {
        // initial state
        const user = this.awarenessService.currentUser;

        const beginSessionMessage: BeginSessionMessage = {
            type: WebviewMessageType.BEGIN_SESSION,
            user: user,
        };
        postMessage(beginSessionMessage);

        // chat updates
        this.chatService.onChatHistoryDidChange(() => {
            const m: UpdateChatHistoryEvent = {
                type: WebviewMessageType.UPDATE_CHAT_HISTORY,
                updated_history: this.chatService.chatHistory.map(Mapper.toChatHistoryItemDto)
            };
            postMessage(m);
        }, null, this.disposables)
    }

    unbind(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables.length = 0;
    }

    sendChatMessage(message: string): void {
        this.chatService.sendChatMessage(message);
    }
}
