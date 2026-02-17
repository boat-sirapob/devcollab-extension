import "reflect-metadata";

import * as vscode from "vscode";

import { ChatViewProvider } from "./ui/chat-view/ChatViewProvider.js";
import { ExtensionState } from "./state.js";
import { IPersistenceService } from "./interfaces/IPersistenceService.js";
import { ISessionService } from "./interfaces/ISessionService.js";
import { PersistenceService } from "./services/PersistenceService.js";
import { SessionInfoWebviewProvider } from "./ui/session-info-webview/SessionInfoWebviewProvider.js";
import { SessionService } from "./services/SessionService.js";
import { SharedServersViewProvider } from "./ui/shared-servers-view/SharedServersViewProvider.js";
import { SharedTerminalsViewProvider } from "./ui/shared-terminals-view/SharedTerminalsViewProvider.js";
import { StatusBarProvider } from "./ui/status-bar/StatusBarProvider.js";
import { container } from "tsyringe";

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
    container.registerSingleton<SessionInfoWebviewProvider>(
        "SessionInfoWebviewProvider",
        SessionInfoWebviewProvider
    );
    const sessionInfoProvider = container.resolve<SessionInfoWebviewProvider>(
        "SessionInfoWebviewProvider"
    );
    vscode.window.registerWebviewViewProvider(
        sessionInfoProvider.viewType,
        sessionInfoProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        }
    );

    container.registerSingleton<ChatViewProvider>(
        "ChatViewProvider",
        ChatViewProvider
    );
    const chatProvider = container.resolve<ChatViewProvider>("ChatViewProvider");
    vscode.window.registerWebviewViewProvider(
        chatProvider.viewType,
        chatProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
        }
    );

    container.registerSingleton<SharedTerminalsViewProvider>(
        "SharedTerminalsViewProvider",
        SharedTerminalsViewProvider
    );
    const terminalsProvider = container.resolve<SharedTerminalsViewProvider>("SharedTerminalsViewProvider");
    vscode.window.createTreeView(terminalsProvider.viewType, {
        treeDataProvider: terminalsProvider,
    });

    container.registerSingleton<SharedServersViewProvider>(
        "SharedServersViewProvider",
        SharedServersViewProvider
    );
    const serversProvider = container.resolve<SharedServersViewProvider>("SharedServersViewProvider");
    vscode.window.createTreeView(serversProvider.viewType, {
        treeDataProvider: serversProvider,
    });
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
        {
            command: "devcollab.shareTerminal",
            callback: state.shareTerminal,
        },
        {
            command: "devcollab.joinSharedTerminal",
            callback: state.joinSharedTerminal,
        },
        {
            command: "devcollab.joinTerminalById",
            callback: state.joinTerminalById,
        },
        {
            command: "devcollab.stopSharedTerminal",
            callback: state.stopSharingTerminal,
        },
        {
            command: "devcollab.shareServer",
            callback: state.shareServer,
        },
        {
            command: "devcollab.joinSharedServer",
            callback: state.joinSharedServer,
        },
        {
            command: "devcollab.joinServerById",
            callback: state.joinServerById,
        },
        {
            command: "devcollab.stopSharedServer",
            callback: state.stopSharedServer,
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

export function registerExtensionContext(context: vscode.ExtensionContext) {
    container.registerInstance<vscode.ExtensionContext>(
        "ExtensionContext",
        context
    );
}

export function registerServices() {
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

export function deactivate() {
    state.dispose();
}
