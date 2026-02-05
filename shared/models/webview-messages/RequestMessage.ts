import type { WebviewMessageBase } from "./WebviewMessageBase.js";
import { WebviewMessageType } from "../../enums/WebviewMessageType.js";

export interface RequestMessage extends WebviewMessageBase {
    type: WebviewMessageType.REQUEST;
    id: number;
    method: "GET" | "POST";
    endpoint: string;
    data?: any;
}
