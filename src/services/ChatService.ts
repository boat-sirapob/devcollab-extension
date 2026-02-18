import * as vscode from "vscode";
import * as Y from "yjs";
import { injectable, inject } from "tsyringe";
import { IChatService } from "../interfaces/IChatService.js";
import { Session } from "../session/Session.js";
import { ChatHistoryItem, ChatHistoryItemType, ChatMessage } from "../../shared/models/ChatHistoryItem.js";
import { v4 as uuidv4 } from "uuid";
import { IAwarenessService } from "../interfaces/IAwarenessService.js";
import { Mapper } from "../../shared/helpers/Mapper.js";
import { ChatHistoryItemDto, ChatMessageDto } from "../../shared/dtos/ChatHistoryItemDto.js";
import { ITelemetryService } from "../interfaces/ITelemetryService.js";

@injectable()
export class ChatService implements IChatService {
    private _chatHistory: Y.Array<ChatHistoryItemDto>;

    private _onChatHistoryDidChange = new vscode.EventEmitter<void>();
    readonly onChatHistoryDidChange = this._onChatHistoryDidChange.event;

    constructor(
        @inject("Session") private session: Session,
        @inject("IAwarenessService") private awarenessService: IAwarenessService,
        @inject("ITelemetryService") private telemetryService: ITelemetryService
    ) {
        this._chatHistory = this.session.doc.getArray("chat-history");
        this._chatHistory.observe((event: Y.YArrayEvent<ChatHistoryItemDto>) => {
            event.delta?.forEach((op) => {
                if (op.insert) {
                    const items = op.insert as ChatHistoryItemDto[];
                    items.forEach((item) => {
                        if (item.type === ChatHistoryItemType.MESSAGE) {
                            const message = item as ChatMessageDto;
                            if (message.senderId !== this.awarenessService.currentUser.clientId) {
                                vscode.window.showInformationMessage(`New message from ${message.displayName}: ${message.content}`);
                            }
                        }
                    });
                }
            });
            this._onChatHistoryDidChange.fire();
        });
    }

    get chatHistory(): ChatHistoryItem[] {
        return this._chatHistory.map(Mapper.fromChatHistoryItemDto);
    }

    sendChatMessage(message: string): void {
        const awarenessService = this.awarenessService;

        const msg: ChatMessage = {
            type: ChatHistoryItemType.MESSAGE,
            id: uuidv4(),
            senderId: awarenessService.currentUser.clientId,
            displayName: awarenessService.currentUser.displayName,
            content: message,
            timestamp: new Date(),
        }

        this._chatHistory.push([Mapper.toChatHistoryItemDto(msg)]);
        this.telemetryService.recordAction("chat_sent");
    }
}
