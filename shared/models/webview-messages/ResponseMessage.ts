import type { WebviewMessageBase } from "./WebviewMessageBase.js";
import { WebviewMessageType } from "../../enums/WebviewMessageType.js";

export interface ResponseMessage extends WebviewMessageBase {
    type: WebviewMessageType.RESPONSE;
    id: number;
    result?: any;
    error?: string;
}
