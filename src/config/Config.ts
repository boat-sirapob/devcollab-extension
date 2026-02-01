import * as vscode from "vscode";

export class Config {
    static getWebSocketUrl(): string {
        return vscode.workspace
            .getConfiguration("devcollab")
            .get("serverUrl", "ws://localhost:1234");
    }

    static getHttpServerUrl(): string {
        return vscode.workspace
            .getConfiguration("devcollab")
            .get("httpServerUrl", "http://localhost:1234");
    }

    static readonly USER_COLORS = [
        "#30bced",
        "#6eeb83",
        "#ffbc42",
        "#ecd444",
        "#ee6352",
        "#9ac2c9",
        "#8acb88",
        "#1be7ff",
    ];

    static getRandomUserColor(): string {
        return this.USER_COLORS[
            Math.floor(Math.random() * this.USER_COLORS.length)
        ];
    }
}
