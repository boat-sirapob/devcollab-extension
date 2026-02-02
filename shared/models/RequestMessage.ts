import { WebviewMessageType } from "../enums/WebviewMessageType.js";
import { WebviewMessageBase } from "./WebviewMessageBase.js";

export interface RequestMessage extends WebviewMessageBase {
    type: WebviewMessageType.REQUEST;
    id: number;
    method: "GET" | "POST";
    endpoint: string;
    data?: any;
}
