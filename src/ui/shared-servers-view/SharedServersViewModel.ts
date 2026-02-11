import { inject, injectable } from "tsyringe";
import { ISharedServerService } from "../../interfaces/ISharedServerService.js";
import { SessionInfo } from "../../session/SessionInfo.js";
import { ServerInfo } from "../../models/ServerInfo.js";

@injectable()
export class SharedServersViewModel {
    constructor(
        @inject("ISharedServerService")
        private sharedServerService: ISharedServerService,
        @inject("SessionInfo") private sessionInfo: SessionInfo
    ) { }

    getActiveServers(): ServerInfo[] {
        return this.sharedServerService
            .getSharedServers()
            .filter((s) => s.active);
    }
}
