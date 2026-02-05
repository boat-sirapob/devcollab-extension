import { SessionParticipant } from "../SessionParticipant.js";
import { WebviewMessageBase } from "./WebviewMessageBase.js";
import { WebviewMessageType } from "../../enums/WebviewMessageType.js";

export interface BeginSessionMessage extends WebviewMessageBase {
    type: WebviewMessageType.BEGIN_SESSION;
    user: SessionParticipant;
}
