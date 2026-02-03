import * as vscode from "vscode";
import { injectable, inject } from "tsyringe";
import { IChatService } from "../interfaces/IChatService.js";

@injectable()
export class ChatService implements IChatService {
    constructor(
        @inject("ExtensionContext") private context: vscode.ExtensionContext
    ) { }

    sendChatMessage(message: string): void {

    }
}
