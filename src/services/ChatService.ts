import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { IChatService } from "../interfaces/IChatService.js";
import { Session } from "../session/Session.js";

@injectable()
export class ChatService implements IChatService {
    constructor(
        @inject("Session") private session: Session
    ) { }

    sendChatMessage(message: string): void {

    }
}
