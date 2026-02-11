import { inject, injectable } from "tsyringe";
import { ITerminalService } from "../../interfaces/ITerminalService.js";
import { SessionInfo } from "../../session/SessionInfo.js";
import { TerminalInfo } from "../../models/TerminalInfo.js";

@injectable()
export class SharedTerminalsViewModel {
    constructor(
        @inject("ITerminalService") private terminalService: ITerminalService,
        @inject("SessionInfo") private sessionInfo: SessionInfo
    ) { }

    getChildrenWithSession(): TerminalInfo[] {
        return this.terminalService
            .getSharedTerminals()
            .filter((t) => t.active);
    }
}