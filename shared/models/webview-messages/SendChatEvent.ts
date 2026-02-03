import type { WebviewMessageBase } from "./WebviewMessageBase.js";
import { WebviewMessageType } from "../../enums/WebviewMessageType.js";

export interface SendChatEvent extends WebviewMessageBase {
    type: WebviewMessageType.CHAT_MESSAGE;
    message: string;
    timestamp: Date;
}
