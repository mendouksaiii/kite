import { MemoryStore } from "../../memory.js";
import { SchedulerService, Reminder } from "../../scheduler.js";
import { ModelRouter } from "../model-router.js";
import { AgentResponse, InboundMedia } from "../types.js";
import { getKiteSystemPrompt } from "../../persona.js";

export class MultimodalAgent {
  constructor(
    private memory: MemoryStore,
    private scheduler: SchedulerService,
    private modelRouter: ModelRouter
  ) {}

  async handleVoiceNote(
    userId: string,
    optionalText: string,
    media: InboundMedia
  ): Promise<AgentResponse> {
    const activeCount = this.scheduler.getActiveReminders(userId).length;
    const remindersSummary = this.scheduler.getRemindersSummary(userId);
    const context = this.memory.getUserContext(userId, activeCount, remindersSummary);

    const systemPrompt = `${getKiteSystemPrompt(context)}
SPECIAL VOICE MEMO INSTRUCTION:
The user sent an audio voice recording over iMessage.
1. Transcribe the core message.
2. Extract any tasks, to-dos, or scheduled reminders into "detectedReminder".
3. Reply warmly with an organized, concise breakdown and reassure them that you're on top of it.`;

    const modelRes = await this.modelRouter.callGemini(
      systemPrompt,
      optionalText || "Please listen to this voice memo, summarize it, and extract action items.",
      context.conversationHistory,
      media
    );

    let parsed: any = {};
    try {
      parsed = JSON.parse(modelRes.rawText);
    } catch {
      parsed = { reply: modelRes.rawText };
    }

    let scheduledReminder: Reminder | undefined = undefined;
    if (parsed.detectedReminder && parsed.detectedReminder.action) {
      const action = parsed.detectedReminder.action;
      const delay = parsed.detectedReminder.delayMinutes;
      if (delay && delay > 0) {
        scheduledReminder = this.scheduler.schedule(userId, action, delay);
      }
    }

    if (Array.isArray(parsed.extractedFacts) && parsed.extractedFacts.length > 0) {
      this.memory.addFacts(userId, parsed.extractedFacts);
    }

    return {
      reply: parsed.reply || "I listened to your voice note and logged your action items!",
      tapback: parsed.tapback || "love",
      effect: parsed.effect || undefined,
      scheduledReminder,
      voiceNoteParsed: true,
      intent: "VOICE_NOTE",
      modelUsed: modelRes.modelUsed,
      latencyMs: modelRes.latencyMs,
    };
  }

  async handleVisionDoc(
    userId: string,
    caption: string,
    media: InboundMedia
  ): Promise<AgentResponse> {
    const activeCount = this.scheduler.getActiveReminders(userId).length;
    const remindersSummary = this.scheduler.getRemindersSummary(userId);
    const context = this.memory.getUserContext(userId, activeCount, remindersSummary);

    const systemPrompt = `${getKiteSystemPrompt(context)}
SPECIAL VISUAL AID & NUTRITION INSTRUCTION:
The user sent an image, document, screenshot, or food photo.
1. If it is a PHOTO OF FOOD/MEALS:
   - Identify the food items and portion.
   - Estimate total calories, protein (g), carbs (g), and fat (g).
   - Populate "nutrition": { "food": "...", "calories": 520, "proteinG": 42, "carbsG": 38, "fatG": 18 }.
   - In "reply", provide a warm, encouraging macro breakdown.
2. If it is a DOCUMENT / RECEIPT / SCREENSHOT:
   - Inspect all text and visual details.
   - Summarize or offer 2 great reply options if it's a conversation.`;

    const modelRes = await this.modelRouter.callGemini(
      systemPrompt,
      caption || "Take a look at this image and tell me what you see or what I should do.",
      context.conversationHistory,
      media
    );

    let parsed: any = {};
    try {
      parsed = JSON.parse(modelRes.rawText);
    } catch {
      parsed = { reply: modelRes.rawText };
    }

    // If nutrition was detected, log it to user's daily fuel log
    if (parsed.nutrition && typeof parsed.nutrition.calories === "number") {
      this.memory.logNutrition(userId, {
        food: parsed.nutrition.food || "Meal",
        calories: parsed.nutrition.calories,
        proteinG: parsed.nutrition.proteinG || 0,
        carbsG: parsed.nutrition.carbsG || 0,
        fatG: parsed.nutrition.fatG || 0,
      });
      console.log(`[Nutrition] Logged meal for ${userId}:`, parsed.nutrition);
    }

    if (Array.isArray(parsed.extractedFacts) && parsed.extractedFacts.length > 0) {
      this.memory.addFacts(userId, parsed.extractedFacts);
    }

    return {
      reply: parsed.reply || "I took a look at the image! Here is what I see.",
      tapback: parsed.tapback || (parsed.nutrition ? "love" : "like"),
      effect: parsed.nutrition ? "confetti" : undefined,
      intent: "VISION_DOC",
      modelUsed: modelRes.modelUsed,
      latencyMs: modelRes.latencyMs,
    };
  }
}
