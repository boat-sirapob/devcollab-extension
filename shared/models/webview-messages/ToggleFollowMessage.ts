import type { WebviewMessageBase } from "./WebviewMessageBase.js";
import { WebviewMessageType } from "../../enums/WebviewMessageType.js";

export interface ToggleFollowMessage extends WebviewMessageBase {
    type: WebviewMessageType.TOGGLE_FOLLOW;
    clientId: number;
}
