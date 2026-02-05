import "reflect-metadata";
import "./index.css";

import App from "./App.tsx";
import { ChatService } from "./services/ChatService.ts";
import { IChatService } from "./interfaces/IChatService.ts";
import type { IMessageService } from "./interfaces/IMessageService.ts";
import { MessageService } from "./services/MessageService.ts";
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
    container.registerSingleton<IMessageService>(
        "IMessageService",
        MessageService
    );
    container.registerSingleton<IChatService>(
        "IChatService",
        ChatService
    );
}
