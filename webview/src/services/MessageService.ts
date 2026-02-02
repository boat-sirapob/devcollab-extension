import type { ChatMessage } from "../models/ChatHistoryItem.js";
import type { IMessageService } from "../interfaces/IMessageService.js";
import type { RequestMessage } from "../../../shared/models/RequestMessage.js";
import type { ResponseMessage } from "../../../shared/models/ResponseMessage.js";
import type { WebviewMessageBase } from "../../../shared/models/WebviewMessageBase.js";
import { WebviewMessageType } from "../../../shared/enums/WebviewMessageType.js";
import { injectable } from "tsyringe";
import { vscode } from "../utilities/vscode.js";

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: ReturnType<typeof setTimeout>;
}

@injectable()
export class MessageService implements IMessageService {
    private requestId = 0;
    private pendingRequests = new Map<number, PendingRequest>();

    constructor() {
        window.addEventListener("message", this.handleMessage);
    }

    private postMessage(message: WebviewMessageBase): void {
        vscode.postMessage(message);
    }

    async request(
        method: "GET" | "POST",
        endpoint: string,
        data?: any
    ): Promise<any> {
        const id = ++this.requestId;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request ${id} timed out`));
            }, 30000);

            this.pendingRequests.set(id, { resolve, reject, timeout });

            const request: RequestMessage = {
                type: WebviewMessageType.REQUEST,
                id,
                method,
                endpoint,
                data,
            };
            this.postMessage(request);
        });
    }

    async get<T>(endpoint: string): Promise<T> {
        return this.request("GET", endpoint) as Promise<T>;
    }

    async post<T>(endpoint: string, data: any): Promise<T> {
        return this.request("POST", endpoint, data) as Promise<T>;
    }

    private handleMessage = (event: MessageEvent<ResponseMessage>) => {
        const message = event.data;

        if (message.type === WebviewMessageType.RESPONSE && message.id) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(message.id);

                message.error
                    ? pending.reject(new Error(message.error))
                    : pending.resolve(message.result);
            }
        }
    };

    getChatMessages(): Promise<ChatMessage[]> {
        return this.get<ChatMessage[]>("/messages");
    }
}
