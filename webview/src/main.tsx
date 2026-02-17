import "reflect-metadata";
import "./index.css";

import App from "./App.tsx";
import { ChatService } from "./services/ChatService.ts";
import { IChatService } from "./interfaces/IChatService.ts";
import { ISessionInfoService } from "./interfaces/ISessionInfoService.ts";
import { SessionInfoService } from "./services/SessionInfoService.ts";
import { StrictMode } from "react";
import { container } from "tsyringe";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);

registerServices();

function registerServices() {
    container.registerSingleton<IChatService>(
        "IChatService",
        ChatService
    );
    container.registerSingleton<ISessionInfoService>(
        "ISessionInfoService",
        SessionInfoService
    );
}
