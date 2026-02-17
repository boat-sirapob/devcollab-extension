import { WebviewMessageBase } from "./WebviewMessageBase.js";
import { WebviewMessageType } from "../../enums/WebviewMessageType.js";

export interface EndSessionMessage extends WebviewMessageBase {
    type: WebviewMessageType.END_SESSION;
}
