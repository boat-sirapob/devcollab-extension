import { ChatHistoryItemDto } from "../../dtos/ChatHistoryItemDto.js";
import type { WebviewMessageBase } from "./WebviewMessageBase.js";
import { WebviewMessageType } from "../../enums/WebviewMessageType.js";

export interface UpdateChatHistoryEvent extends WebviewMessageBase {
    type: WebviewMessageType.UPDATE_CHAT_HISTORY;
    updated_history: ChatHistoryItemDto[];
}
