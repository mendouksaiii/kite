import { SchedulerService } from "../scheduler.js";
import { MemoryStore } from "../memory.js";
import { ModelRouter } from "./model-router.js";
import { IntentDetector } from "./intent.js";
import { MicroToolAgent } from "./subagents/microtools.js";
import { TimekeeperAgent } from "./subagents/timekeeper.js";
import { TrackerAgent } from "./subagents/tracker.js";
import { AssistantAgent } from "./subagents/assistant.js";
import { MultimodalAgent } from "./subagents/multimodal.js";
import { CompanionAgent } from "./subagents/companion.js";
import { AgentIntent, AgentResponse, InboundMedia } from "./types.js";

export class AgentRouter {
  private intentDetector: IntentDetector;
  private microtools: MicroToolAgent;
  private timekeeper: TimekeeperAgent;
  private tracker: TrackerAgent;
  private assistant: AssistantAgent;
  private multimodal: MultimodalAgent;
  private companion: CompanionAgent;

  constructor(
    private memory: MemoryStore,
    private scheduler: SchedulerService,
    private modelRouter: ModelRouter = new ModelRouter()
  ) {
    this.intentDetector = new IntentDetector();
    this.microtools = new MicroToolAgent();
    this.timekeeper = new TimekeeperAgent(this.scheduler, this.memory, this.modelRouter);
    this.tracker = new TrackerAgent(this.memory);
    this.assistant = new AssistantAgent(this.memory, this.modelRouter);
    this.multimodal = new MultimodalAgent(this.memory, this.scheduler, this.modelRouter);
    this.companion = new CompanionAgent(this.scheduler, this.memory, this.modelRouter);
  }

  async route(
    userId: string,
    userText: string,
    media?: InboundMedia
  ): Promise<AgentResponse> {
    const cleanText = (userText || "").trim();
    const lower = cleanText.toLowerCase();

    // Guard: completely empty payload without media
    if (!cleanText && !media) {
      return {
        reply: "I'm right here with you! Did you send something just now? I might not have caught the text or attachment—could you try sending it once more?",
        tapback: "question",
        intent: "COMPANION_CHAT",
        modelUsed: "guard-fallback",
        latencyMs: 0,
      };
    }

    // 1. Intent Detection
    const intent: AgentIntent = this.intentDetector.detect(cleanText, media);
    console.log(`[AgentRouter] Routed user ${userId} to intent: ${intent}`);

    let response: AgentResponse;

    // 2. Dispatch to Sub-Agent
    switch (intent) {
      case "MATH_SPLIT": {
        response = this.microtools.handleBillSplit(cleanText);
        break;
      }

      case "UNIT_CONVERT": {
        response = this.microtools.handleUnitConvert(cleanText);
        break;
      }

      case "EXPENSE_TRACK": {
        response = this.tracker.handleExpense(userId, cleanText);
        break;
      }

      case "HABIT_LOG": {
        response = this.tracker.handleHabit(userId, cleanText);
        break;
      }

      case "HYDRATION_LOG": {
        response = this.tracker.handleHydration(userId, cleanText);
        break;
      }

      case "FOCUS_SPRINT": {
        response = this.timekeeper.handleFocusSprint(userId, cleanText);
        break;
      }

      case "DAILY_BRIEF": {
        const isEvening = lower.includes("night") || lower.includes("wind down");
        response = await this.timekeeper.handleDailyBrief(userId, isEvening);
        break;
      }

      case "GHOSTWRITE": {
        response = await this.assistant.handleGhostwrite(userId, cleanText);
        break;
      }

      case "LINK_SUMMARY": {
        response = await this.assistant.handleLinkSummary(userId, cleanText);
        break;
      }

      case "WEB_SEARCH": {
        response = await this.assistant.handleWebSearch(userId, cleanText);
        break;
      }

      case "TASK_ACK": {
        response = this.timekeeper.handleTaskAck(userId, cleanText);
        break;
      }

      case "TIME_QUERY": {
        if (
          lower === "!reminders" ||
          lower === "reminders" ||
          lower === "what are my reminders" ||
          lower === "list reminders"
        ) {
          response = this.timekeeper.handleRemindersList(userId);
        } else {
          response = await this.timekeeper.handleTimeQueryOrReminder(userId, cleanText, false);
        }
        break;
      }

      case "SET_REMINDER": {
        response = await this.timekeeper.handleTimeQueryOrReminder(userId, cleanText, true);
        break;
      }

      case "VOICE_NOTE": {
        if (media) {
          response = await this.multimodal.handleVoiceNote(userId, cleanText, media);
        } else {
          response = await this.companion.handleConversation(userId, cleanText);
        }
        break;
      }

      case "VISION_DOC": {
        if (media) {
          response = await this.multimodal.handleVisionDoc(userId, cleanText, media);
        } else {
          response = await this.companion.handleConversation(userId, cleanText);
        }
        break;
      }

      case "COMPANION_CHAT":
      default: {
        response = await this.companion.handleConversation(userId, cleanText);
        break;
      }
    }

    // 3. Update Conversation History in MemoryStore
    let historyUserEntry = cleanText;
    if (intent === "VOICE_NOTE") {
      historyUserEntry = cleanText ? `[Voice Note]: ${cleanText}` : "[Voice Note Memo]";
    } else if (intent === "VISION_DOC") {
      historyUserEntry = cleanText ? `[Photo]: ${cleanText}` : "[Photo Attachment]";
    }

    if (historyUserEntry) {
      this.memory.addHistory(userId, "user", historyUserEntry);
    }
    if (response.reply) {
      this.memory.addHistory(userId, "kite", response.reply);
    }

    console.log(
      `[AgentRouter] Finished intent=${response.intent} model=${response.modelUsed} latency=${response.latencyMs}ms`
    );

    return response;
  }
}
