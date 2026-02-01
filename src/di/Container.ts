import "reflect-metadata";

import { ExtensionState } from "../state.js";
import { FollowService } from "../services/FollowService.js";
import { IFollowService } from "../interfaces/IFollowService.js";
import { ISessionService } from "../interfaces/ISessionService.js";
import { SessionService } from "../services/SessionService.js";
import { container } from "tsyringe";

export function registerServices() {
    container.registerSingleton<IFollowService>(
        "IFollowService",
        FollowService
    );
    container.registerSingleton<ISessionService>(
        "ISessionService",
        SessionService
    );
    container.registerSingleton(ExtensionState);
}

export default container;
