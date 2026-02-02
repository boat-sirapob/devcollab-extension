import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import "reflect-metadata";

import { container } from "tsyringe";
import type { IMessageService } from "./interfaces/IMessageService.ts";
import { MessageService } from "./services/MessageService.ts";

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
}
