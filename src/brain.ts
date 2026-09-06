import { MemoryStore } from "./memory.js";
import { SchedulerService, Reminder } from "./scheduler.js";
import { AgentRouter, AgentResponse, InboundMedia } from "./router/index.js";

export type KiteResponse = AgentResponse;
export { InboundMedia, Reminder };

export class KiteBrain {
  private router: AgentRouter;

  constructor(
    private memory: MemoryStore,
    private scheduler: SchedulerService
  ) {
    this.router = new AgentRouter(this.memory, this.scheduler);
  }

  async processMessage(
    userId: string,
    userText: string,
    media?: InboundMedia
  ): Promise<KiteResponse> {
    return await this.router.route(userId, userText, media);
  }
}
