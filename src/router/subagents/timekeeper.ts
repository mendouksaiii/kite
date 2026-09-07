import { SchedulerService, Reminder } from "../../scheduler.js";
import { MemoryStore } from "../../memory.js";
import { ModelRouter } from "../model-router.js";
import { AgentResponse } from "../types.js";
import { getKiteSystemPrompt } from "../../persona.js";

export class TimekeeperAgent {
  constructor(
    private scheduler: SchedulerService,
    private memory: MemoryStore,
    private modelRouter: ModelRouter
  ) {}

  handleTaskAck(userId: string, userText: string): AgentResponse {
    const start = Date.now();
    const latest = this.scheduler.getLatestTriggered(userId);
    if (latest) {
      this.scheduler.markAcknowledged(latest.id);
      this.memory.incrementCompletedTasks(userId);
      return {
        reply: `Awesome! Checked off: "${latest.text}". Proud of you! 🎉`,
        tapback: "love",
        effect: "confetti",
        intent: "TASK_ACK",
        modelUsed: "timekeeper-fast-ack",
        latencyMs: Date.now() - start,
      };
    }

    return {
      reply: "Great job! I've logged your progress. Keep up the great momentum! 🌟",
      tapback: "like",
      intent: "TASK_ACK",
      modelUsed: "timekeeper-fast-ack",
      latencyMs: Date.now() - start,
    };
  }

  handleRemindersList(userId: string): AgentResponse {
    const start = Date.now();
    const active = this.scheduler.getActiveReminders(userId);
    if (active.length === 0) {
      return {
        reply: "You're all clear! No pending reminders right now. ☀️",
        tapback: "like",
        intent: "TIME_QUERY",
        modelUsed: "timekeeper-status",
        latencyMs: Date.now() - start,
      };
    }

    const list = active
      .map(
        (r, i) =>
          `${i + 1}. ${r.text} (due in ${Math.max(
            1,
            Math.round((r.dueAt - Date.now()) / 60000)
          )} mins)`
      )
      .join("\n");

    return {
      reply: `📋 YOUR ACTIVE REMINDERS:\n${list}\n\nTap or reply 'done' when you finish one!`,
      tapback: "emphasize",
      intent: "TIME_QUERY",
      modelUsed: "timekeeper-status",
      latencyMs: Date.now() - start,
    };
  }

  handleFocusSprint(userId: string, userText: string): AgentResponse {
    const start = Date.now();
    const match = userText.match(/\b(\d+)\b/);
    const duration = match ? parseInt(match[1], 10) : 25;
    const safeDuration = Math.min(120, Math.max(1, duration));

    const reminder = this.scheduler.schedule(
      userId,
      `🎯 Focus sprint complete! Great work. Take a 5-minute breather and stretch ☕`,
      safeDuration
    );

    return {
      reply: `🎯 FOCUS MODE ENGAGED (${safeDuration} mins)
────────────────────
Put away distractions and lock into your flow.
I'll ping you right when time's up for your break! 🚀`,
      tapback: "love",
      effect: "slam",
      scheduledReminder: reminder,
      intent: "FOCUS_SPRINT",
      modelUsed: "timekeeper-focus",
      latencyMs: Date.now() - start,
    };
  }

  async handleDailyBrief(userId: string, isEvening: boolean): Promise<AgentResponse> {
    const start = Date.now();
    const active = this.scheduler.getActiveReminders(userId);
    const profile = this.memory.getProfile(userId);
    const expenses = this.memory.getTodayExpenses(userId);
    const hydration = this.memory.getHydration(userId);
    const habits = this.memory.getHabits(userId);
    const name = profile.name || "friend";

    if (isEvening) {
      const reply = `🌙 NIGHTLY WIND-DOWN, ${name}!
────────────────────
• ✅ Tasks Completed Today: ${profile.completedTasks}
• 💳 Today's Spend: $${expenses.total.toFixed(2)} ($${expenses.remaining.toFixed(2)} budget left)
• 💧 Hydration: ${hydration.currentMl} / ${hydration.targetMl} ml (${hydration.percent}%)
• 🔥 Habits Active: ${habits.length}
────────────────────
Anything you want to offload to tomorrow's list before you get some rest? 😴`;

      return {
        reply,
        tapback: "love",
        intent: "DAILY_BRIEF",
        modelUsed: "timekeeper-brief",
        latencyMs: Date.now() - start,
      };
    }

    // Morning Launchpad
    const remindersText =
      active.length > 0
        ? active.map((r) => `  • ${r.text}`).join("\n")
        : "  • No pending alarms (clear schedule!)";

    const habitText =
      habits.length > 0
        ? habits.map((h) => `  • ${h.name} (${h.streak} day streak 🔥)`).join("\n")
        : "  • No active habit streaks yet";

    const reply = `☀️ GOOD MORNING, ${name}!
Here is your daily launchpad:
────────────────────
📋 TODAY'S REMINDERS:
${remindersText}

🔥 HABITS TO CRUSH:
${habitText}

💧 HYDRATION TARGET: ${hydration.targetMl} ml
💰 DAILY BUDGET: $${expenses.budget.toFixed(2)}
────────────────────
Let's make today count! What are we conquering first? 🚀`;

    return {
      reply,
      tapback: "like",
      effect: "confetti",
      intent: "DAILY_BRIEF",
      modelUsed: "timekeeper-brief",
      latencyMs: Date.now() - start,
    };
  }

  async handleTimeQueryOrReminder(
    userId: string,
    userText: string,
    isScheduleCommand: boolean
  ): Promise<AgentResponse> {
    const activeCount = this.scheduler.getActiveReminders(userId).length;
    const remindersSummary = this.scheduler.getRemindersSummary(userId);
    const context = this.memory.getUserContext(userId, activeCount, remindersSummary);

    const systemPrompt = `${getKiteSystemPrompt(context)}
SPECIAL TIMEKEEPER INSTRUCTION:
The user is either setting a reminder or querying time/schedule status.
- Pay meticulous attention to timestamps, intervals, and current time.
- If setting a reminder, populate "detectedReminder" with action and delayMinutes or targetIsoTime.
- If asking about schedule or whether a timer finished, refer to the exact trigger times provided above.`;

    const modelRes = await this.modelRouter.generateJson(
      systemPrompt,
      userText,
      context.conversationHistory
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

    if (Array.isArray(parsed.extractedFacts) && parsed.extractedFacts.length > 0) {
      this.memory.addFacts(userId, parsed.extractedFacts);
    }

    return {
      reply: parsed.reply || "Got it! I've updated your schedule.",
      tapback: parsed.tapback || (scheduledReminder ? "like" : undefined),
      effect: parsed.effect || undefined,
      scheduledReminder,
      intent: isScheduleCommand ? "SET_REMINDER" : "TIME_QUERY",
      modelUsed: modelRes.modelUsed,
      latencyMs: modelRes.latencyMs,
    };
  }
}
