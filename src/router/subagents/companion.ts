import { SchedulerService, Reminder } from "../../scheduler.js";
import { MemoryStore } from "../../memory.js";
import { ModelRouter } from "../model-router.js";
import { AgentResponse } from "../types.js";
import { getKiteSystemPrompt } from "../../persona.js";

export class CompanionAgent {
  constructor(
    private scheduler: SchedulerService,
    private memory: MemoryStore,
    private modelRouter: ModelRouter
  ) {}

  async handleConversation(
    userId: string,
    userText: string
  ): Promise<AgentResponse> {
    const activeCount = this.scheduler.getActiveReminders(userId).length;
    const remindersSummary = this.scheduler.getRemindersSummary(userId);
    const context = this.memory.getUserContext(userId, activeCount, remindersSummary);

    const systemPrompt = getKiteSystemPrompt(context);

    const modelRes = await this.modelRouter.generateJson(
      systemPrompt,
      userText,
      context.conversationHistory
    );

    let parsed: any = {};
    try {
      parsed = JSON.parse(modelRes.rawText);
    } catch {
      parsed = { reply: modelRes.rawText.trim() };
    }

    // Save any newly discovered facts
    if (Array.isArray(parsed.extractedFacts) && parsed.extractedFacts.length > 0) {
      this.memory.addFacts(userId, parsed.extractedFacts);
      console.log(`[Memory] Saved new facts for ${userId}:`, parsed.extractedFacts);
    }

    // Opportunistic reminder scheduling if user mentioned a reminder in casual conversation
    let scheduledReminder: Reminder | undefined = undefined;
    if (parsed.detectedReminder && parsed.detectedReminder.action) {
      const action = parsed.detectedReminder.action;
      const delay = parsed.detectedReminder.delayMinutes;
      const iso = parsed.detectedReminder.targetIsoTime;

      if (delay && delay > 0) {
        scheduledReminder = this.scheduler.schedule(userId, action, delay);
      } else if (iso) {
        const target = new Date(iso);
        if (!isNaN(target.getTime()) && target.getTime() > Date.now()) {
          scheduledReminder = this.scheduler.scheduleAt(userId, action, target);
        }
      }
    }

    return {
      reply: parsed.reply || "I'm right here with you! What's on your mind?",
      tapback: parsed.tapback || undefined,
      effect: parsed.effect || undefined,
      scheduledReminder,
      intent: "COMPANION_CHAT",
      modelUsed: modelRes.modelUsed,
      latencyMs: modelRes.latencyMs,
    };
  }
}
