import "reflect-metadata";

import * as vscode from "vscode";

import { ChatService } from "../services/ChatService.js";
import { ExtensionState } from "../state.js";
import { FollowService } from "../services/FollowService.js";
import { IChatService } from "../interfaces/IChatService.js";
import { IFollowService } from "../interfaces/IFollowService.js";
import { IPersistenceService } from "../interfaces/IPersistenceService.js";
import { ISessionService } from "../interfaces/ISessionService.js";
import { PersistenceService } from "../services/PersistenceService.js";
import { SessionService } from "../services/SessionService.js";
import { container } from "tsyringe";

export function registerExtensionContext(context: vscode.ExtensionContext) {
    container.registerInstance<vscode.ExtensionContext>(
        "ExtensionContext",
        context
    );
}

export function registerServices() {
    container.registerSingleton<IChatService>(
        "IChatService",
        ChatService
    );
    container.registerSingleton<IFollowService>(
        "IFollowService",
        FollowService
    );
    container.registerSingleton<ISessionService>(
        "ISessionService",
        SessionService
    );
    container.registerSingleton<IPersistenceService>(
        "IPersistenceService",
        PersistenceService
    );
    container.registerSingleton(ExtensionState);
}

export default container;
