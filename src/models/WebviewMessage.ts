import { WebviewMessageType } from "../enums/WebviewMessageType.js";

export interface WebviewMessage {
  type: WebviewMessageType,
  value: any
}
