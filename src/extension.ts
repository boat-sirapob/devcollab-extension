import "reflect-metadata";

import * as vscode from "vscode";

import container, { registerExtensionContext } from "./di/Container.js";

import { ChatViewProvider } from "./ui/chat-view/ChatViewProvider.js";
import { ExtensionState } from "./state.js";
import { ISessionService } from "./interfaces/ISessionService.js";
import { SessionInfoViewProvider } from "./ui/session-info-view/SessionInfoViewProvider.js";
import { StatusBarProvider } from "./ui/status-bar/StatusBarProvider.js";
import { registerServices } from "./di/Container.js";

let state: ExtensionState;

export function activate(context: vscode.ExtensionContext) {
    registerServices();
    registerExtensionContext(context);
    initializeState(context);
    registerViewProviders(context);
    registerCommands(context);
    registerStatusBar(context);
}

export function initializeState(context: vscode.ExtensionContext) {
    state = container.resolve(ExtensionState);
    state
        .restorePendingSession()
        .then(() => {
            state.cleanupOldTempDirs();
        })
        .catch((err) => {
            console.error("Failed to restore pending session:", err);
        });

    vscode.commands.executeCommand(
        "setContext",
        "devcollab.isInSession",
        false
    );

    state.onDidChange(() => {
        const sessionService: ISessionService = container.resolve("ISessionService");

        vscode.commands.executeCommand(
            "setContext",
            "devcollab.isInSession",
            sessionService.hasSession()
        );
    }, context.subscriptions);
}

export function registerViewProviders(context: vscode.ExtensionContext) {
    const sessionService: ISessionService = container.resolve("ISessionService");

    const sidebarProvider = new SessionInfoViewProvider(state, sessionService);
    vscode.window.createTreeView(sidebarProvider.viewType, {
        treeDataProvider: sidebarProvider,
    });

    const chatProvider = new ChatViewProvider(
        sessionService,
        context.extensionUri
    );
    vscode.window.registerWebviewViewProvider(
        chatProvider.viewType,
        chatProvider
    );
}

export function registerCommands(context: vscode.ExtensionContext) {
    const commands = [
        {
            command: "devcollab.test",
            callback: state.test,
        },
        {
            command: "devcollab.hostSession",
            callback: state.hostSession,
        },
        {
            command: "devcollab.joinSession",
            callback: state.joinSession,
        },
        {
            command: "devcollab.endSession",
            callback: state.endSession,
        },
        {
            command: "devcollab.undo",
            callback: state.handleUndo,
        },
        {
            command: "devcollab.redo",
            callback: state.handleRedo,
        },
        {
            command: "devcollab.copyRoomCode",
            callback: state.copyRoomCode,
        },
        {
            command: "devcollab.toggleFollow",
            callback: state.toggleFollow,
        },
    ];

    commands.forEach((c) => {
        const disposable = vscode.commands.registerCommand(
            c.command,
            c.callback.bind(state)
        );

        context.subscriptions.push(disposable);
    });
}

export function registerStatusBar(context: vscode.ExtensionContext) {
    const sessionService: ISessionService = container.resolve("ISessionService");

    const statusBarProvider = new StatusBarProvider(state, sessionService);
    context.subscriptions.push(statusBarProvider.getStatusBarItem());
}

export function deactivate() {
    state.dispose();
}
