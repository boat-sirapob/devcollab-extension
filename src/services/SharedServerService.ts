import * as http from "http";
import * as net from "net";
import * as Y from "yjs";
import * as vscode from "vscode";

import { inject, injectable } from "tsyringe";

import { ISharedServerService } from "../interfaces/ISharedServerService.js";
import { Session } from "../session/Session.js";
import { SessionInfo } from "../session/SessionInfo.js";
import { ServerInfo } from "../models/ServerInfo.js";
import { TunnelResponse } from "../tunnel/TunnelResponse.js";
import { TunnelRequest } from "../tunnel/TunnelRequest.js";
import { ITelemetryService } from "../interfaces/ITelemetryService.js";
import { IAwarenessService } from "../interfaces/IAwarenessService.js";

/**
 *   "server:registry"           – Y.Map<ServerInfo>   shared-server catalogue
 *   "server:<id>:requests"      – Y.Map<string>       guest  -> host  (request descriptors)
 *   "server:<id>:responses"     – Y.Map<string>       host   -> guest (response descriptors)
 */
@injectable()
export class SharedServerService implements ISharedServerService {
    private registry: Y.Map<ServerInfo>;

    private localProxies = new Map<string, http.Server>();
    private hostObservers = new Map<string, () => void>();
    private pendingRequests = new Map<string, (res: TunnelResponse) => void>();

    private responseObservers = new Map<string, () => void>();

    private participantRemovedListener: vscode.Disposable;

    private _onRegistryChange = new vscode.EventEmitter<void>();
    readonly onRegistryChange: vscode.Event<void> = this._onRegistryChange.event;

    constructor(
        @inject("Session") private session: Session,
        @inject("SessionInfo") private sessionInfo: SessionInfo,
        @inject("ITelemetryService") private telemetryService: ITelemetryService,
        @inject("IAwarenessService") private awarenessService: IAwarenessService,
    ) {
        this.registry = this.session.doc.getMap<ServerInfo>("server:registry");
        this.registry.observe(() => {
            this._onRegistryChange.fire();
        });

        this.participantRemovedListener = this.awarenessService.onParticipantRemoved((username: string) => {
            this.removeServersByOwner(username);
        });
    }

    getSharedServers(): ServerInfo[] {
        const result: ServerInfo[] = [];
        this.registry.forEach((entry, id) => {
            result.push({ ...entry, id });
        });
        return result;
    }

    async shareServer(): Promise<void> {
        const portStr = await vscode.window.showInputBox({
            prompt: "Enter the local port number to share",
            placeHolder: "e.g. 3000",
            validateInput: (v) => {
                const n = parseInt(v, 10);
                if (isNaN(n) || n < 1 || n > 65535) {
                    return "Enter a valid port (1-65535)";
                }
                return undefined;
            },
        });
        if (!portStr) {
            return;
        }
        const port = parseInt(portStr, 10);

        const label =
            (await vscode.window.showInputBox({
                prompt: "Enter a label for this server (optional)",
                placeHolder: `localhost:${port}`,
            })) || `localhost:${port}`;

        const id = this.generateId();

        this.registry.set(id, {
            id,
            port,
            label,
            owner: this.sessionInfo.username,
            active: true,
        });

        this.startHostTunnel(id, port);

        this.telemetryService.recordAction("share_server");

        vscode.window.showInformationMessage(
            `Sharing server on port ${port} as "${label}"`
        );
    }


    private startHostTunnel(serverId: string, localPort: number): void {
        const requestsMap = this.getRequestsMap(serverId);
        const responsesMap = this.getResponsesMap(serverId);

        const observer = (event: Y.YMapEvent<string>) => {
            for (const [reqId, change] of event.changes.keys) {
                if (change.action === "add") {
                    const raw = requestsMap.get(reqId);
                    if (!raw) {
                        continue;
                    }
                    const tunnelReq: TunnelRequest = JSON.parse(raw);
                    this.handleHostRequest(
                        localPort,
                        reqId,
                        tunnelReq,
                        responsesMap,
                        requestsMap
                    );
                }
            }
        };

        requestsMap.observe(observer);
        this.hostObservers.set(serverId, () => requestsMap.unobserve(observer));
    }


    private async handleHostRequest(
        localPort: number,
        reqId: string,
        tunnelReq: TunnelRequest,
        responsesMap: Y.Map<string>,
        requestsMap: Y.Map<string>
    ): Promise<void> {
        try {
            const url = `http://localhost:${localPort}${tunnelReq.path}`;

            const headers: Record<string, string> = {};
            for (const [k, v] of Object.entries(tunnelReq.headers)) {
                const lower = k.toLowerCase();
                if (
                    v &&
                    lower !== "host" &&
                    lower !== "connection" &&
                    lower !== "transfer-encoding"
                ) {
                    headers[k] = Array.isArray(v) ? v.join(", ") : v;
                }
            }

            const hasBody =
                tunnelReq.method !== "GET" && tunnelReq.method !== "HEAD";
            const body =
                hasBody && tunnelReq.body
                    ? Buffer.from(tunnelReq.body, "base64")
                    : undefined;

            const response = await fetch(url, {
                method: tunnelReq.method,
                headers,
                body,
                redirect: "manual",
            });

            const resBody = Buffer.from(await response.arrayBuffer());
            const resHeaders: Record<string, string> = {};
            response.headers.forEach((v, k) => {
                resHeaders[k] = v;
            });

            const tunnelRes: TunnelResponse = {
                statusCode: response.status,
                statusMessage: response.statusText,
                headers: resHeaders,
                body: resBody.toString("base64"),
            };

            responsesMap.set(reqId, JSON.stringify(tunnelRes));

            setTimeout(() => requestsMap.delete(reqId), 2000);
        } catch (err: any) {
            const tunnelRes: TunnelResponse = {
                statusCode: 502,
                statusMessage: "Bad Gateway",
                headers: { "content-type": "text/plain" },
                body: Buffer.from(
                    `Tunnel error: ${err.message}`
                ).toString("base64"),
            };
            responsesMap.set(reqId, JSON.stringify(tunnelRes));
            setTimeout(() => requestsMap.delete(reqId), 2000);
        }
    }

    async joinSharedServer(): Promise<void> {
        const servers = this.getSharedServers().filter(
            (s) => s.active && s.owner !== this.sessionInfo.username
        );
        if (servers.length === 0) {
            vscode.window.showInformationMessage(
                "No shared servers available to join."
            );
            return;
        }

        const pick = await vscode.window.showQuickPick(
            servers.map((s) => ({
                label: s.label,
                description: `Shared by ${s.owner} (port ${s.port})`,
                serverId: s.id,
            })),
            { placeHolder: "Select a shared server to connect to" }
        );
        if (!pick) {
            return;
        }

        await this.joinServerById(pick.serverId);
    }

    async joinServerById(serverId: string): Promise<void> {
        const serverInfo = this.registry.get(serverId);
        if (!serverInfo || !serverInfo.active) {
            vscode.window.showErrorMessage("Server is no longer available.");
            return;
        }

        if (this.localProxies.has(serverId)) {
            const existing = this.localProxies.get(serverId)!;
            const addr = existing.address() as net.AddressInfo;
            vscode.env.openExternal(
                vscode.Uri.parse(`http://localhost:${addr.port}`)
            );
            return;
        }

        const localPort = await this.findFreePort();
        const requestsMap = this.getRequestsMap(serverId);
        const responsesMap = this.getResponsesMap(serverId);

        const responseObserver = (event: Y.YMapEvent<string>) => {
            for (const [reqId, change] of event.changes.keys) {
                if (change.action === "add") {
                    const resolver = this.pendingRequests.get(reqId);
                    if (resolver) {
                        const raw = responsesMap.get(reqId);
                        if (raw) {
                            resolver(JSON.parse(raw));
                            this.pendingRequests.delete(reqId);
                            setTimeout(() => responsesMap.delete(reqId), 2000);
                        }
                    }
                }
            }
        };
        responsesMap.observe(responseObserver);
        this.responseObservers.set(serverId, () =>
            responsesMap.unobserve(responseObserver)
        );

        const proxyServer = http.createServer(async (req, res) => {
            try {
                const body = await this.readRequestBody(req);
                const reqId = this.generateId();

                const tunnelReq: TunnelRequest = {
                    method: req.method || "GET",
                    path: req.url || "/",
                    headers: req.headers as Record<
                        string,
                        string | string[] | undefined
                    >,
                    body:
                        body.length > 0
                            ? body.toString("base64")
                            : undefined,
                };

                const responsePromise = new Promise<TunnelResponse>(
                    (resolve, reject) => {
                        this.pendingRequests.set(reqId, resolve);
                        setTimeout(() => {
                            if (this.pendingRequests.has(reqId)) {
                                this.pendingRequests.delete(reqId);
                                reject(new Error("Request timed out"));
                            }
                        }, 30_000);
                    }
                );

                requestsMap.set(reqId, JSON.stringify(tunnelReq));

                const tunnelRes = await responsePromise;

                const resHeaders: Record<string, string | string[]> = {};
                for (const [k, v] of Object.entries(tunnelRes.headers)) {
                    if (v && k.toLowerCase() !== "transfer-encoding") {
                        resHeaders[k] = v;
                    }
                }

                res.writeHead(
                    tunnelRes.statusCode,
                    tunnelRes.statusMessage,
                    resHeaders
                );
                res.end(Buffer.from(tunnelRes.body, "base64"));
            } catch (err: any) {
                if (!res.headersSent) {
                    res.writeHead(502, "Bad Gateway");
                    res.end(`Proxy error: ${err.message}`);
                }
            }
        });

        proxyServer.listen(localPort, () => {
            this.localProxies.set(serverId, proxyServer);
            this.telemetryService.recordAction("join_server", { serverId });
            vscode.window.showInformationMessage(
                `Connected to ${serverInfo.owner}'s server "${serverInfo.label}" at http://localhost:${localPort}`
            );
            vscode.env.openExternal(
                vscode.Uri.parse(`http://localhost:${localPort}`)
            );
        });
    }

    async stopServer(id?: string): Promise<void> {
        if (!id) {
            const ownServers = this.getSharedServers().filter(
                (s) => s.owner === this.sessionInfo.username && s.active
            );
            if (ownServers.length === 0) {
                vscode.window.showInformationMessage("You have no active shared servers.");
                return;
            }
            let option = await vscode.window.showQuickPick(
                ownServers.map((s) => ({
                    label: s.label,
                    description: `Port ${s.port}`,
                    serverId: s.id,
                })),
                { placeHolder: "Select a shared server to stop" }
            )
            if (option) {
                id = option.serverId;
            } else {
                return;
            }
        }

        const entry = this.registry.get(id);
        if (entry) {
            this.registry.set(id, { ...entry, active: false });
            this.telemetryService.recordAction("close_server", { serverId: id });
        }

        const hostCleanup = this.hostObservers.get(id);
        if (hostCleanup) {
            hostCleanup();
            this.hostObservers.delete(id);
        }

        const proxy = this.localProxies.get(id);
        if (proxy) {
            proxy.close();
            this.localProxies.delete(id);
        }

        const resCleanup = this.responseObservers.get(id);
        if (resCleanup) {
            resCleanup();
            this.responseObservers.delete(id);
        }
    }

    removeServersByOwner(owner: string): void {
        const toDeactivate: string[] = [];
        this.registry.forEach((entry, id) => {
            if (entry.active && entry.owner === owner) {
                toDeactivate.push(id);
            }
        });

        for (const id of toDeactivate) {
            this.stopServer(id);
        }
    }

    dispose(): void {
        const serverIds = new Set([
            ...this.hostObservers.keys(),
            ...this.localProxies.keys(),
            ...this.responseObservers.keys(),
        ]);
        for (const id of serverIds) {
            this.stopServer(id);
        }
        this._onRegistryChange.dispose();
    }

    private getRequestsMap(serverId: string): Y.Map<string> {
        return this.session.doc.getMap<string>(`server:${serverId}:requests`);
    }

    private getResponsesMap(serverId: string): Y.Map<string> {
        return this.session.doc.getMap<string>(`server:${serverId}:responses`);
    }

    private readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
        return new Promise((resolve) => {
            const chunks: Buffer[] = [];
            req.on("data", (chunk: Buffer) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks)));
        });
    }

    private findFreePort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const srv = net.createServer();
            srv.listen(0, () => {
                const port = (srv.address() as net.AddressInfo).port;
                srv.close(() => resolve(port));
            });
            srv.on("error", reject);
        });
    }

    private generateId(): string {
        return (
            Math.random().toString(36).substring(2, 10) +
            Date.now().toString(36)
        );
    }
}
