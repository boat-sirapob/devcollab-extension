import { WebviewMessageBase } from "./WebviewMessageBase.js";
import { WebviewMessageType } from "../../enums/WebviewMessageType.js";

export interface CopyRoomCodeMessage extends WebviewMessageBase {
    type: WebviewMessageType.COPY_ROOM_CODE;
}
