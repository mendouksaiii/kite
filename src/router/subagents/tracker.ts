import { MemoryStore } from "../../memory.js";
import { AgentResponse } from "../types.js";

export class TrackerAgent {
  constructor(private memory: MemoryStore) {}

  handleExpense(userId: string, userText: string): AgentResponse {
    const start = Date.now();
    const clean = userText.trim().toLowerCase();

    // 1. Check if user is asking for summary
    if (
      clean === "expenses" ||
      clean === "spending" ||
      clean === "my expenses" ||
      clean === "budget" ||
      clean === "what did i spend"
    ) {
      const summary = this.memory.getTodayExpenses(userId);
      if (summary.items.length === 0) {
        return {
          reply: `💳 TODAY'S SPENDING:
You haven't logged any expenses today yet. 
🎯 Daily Budget: $${summary.budget.toFixed(2)} ($${summary.remaining.toFixed(2)} remaining).
Tip: Log anytime with "Spent $14 on lunch" or "Uber $22".`,
          tapback: "like",
          intent: "EXPENSE_TRACK",
          modelUsed: "tracker-expense",
          latencyMs: Date.now() - start,
        };
      }

      const itemsList = summary.items
        .map((e) => `• $${e.amount.toFixed(2)} - ${e.note} (${e.category})`)
        .join("\n");

      return {
        reply: `💳 TODAY'S SPENDING BREAKDOWN:
${itemsList}
────────────────────
💰 Total Spent: $${summary.total.toFixed(2)}
🎯 Daily Budget: $${summary.budget.toFixed(2)}
💵 Remaining: $${summary.remaining.toFixed(2)}`,
        tapback: "like",
        intent: "EXPENSE_TRACK",
        modelUsed: "tracker-expense",
        latencyMs: Date.now() - start,
      };
    }

    // 2. Parse Expense Log (e.g. "Spent $14 on lunch", "Uber $22", "Coffee $5.50")
    let amount = 0;
    let note = "Expense";
    let category = "General";

    // Regex 1: "Spent $15 on lunch" / "Paid 20 for uber"
    const pattern1 = clean.match(/(?:spent|paid|cost|bought)\s+\$?(\d+(?:\.\d+)?)(?:\s+(?:on|for)\s+(.+))?/i);
    // Regex 2: "Uber $22" / "Lunch $15" / "Groceries 45"
    const pattern2 = clean.match(/^([a-z\s]+?)\s+\$?(\d+(?:\.\d+)?)$/i);

    if (pattern1) {
      amount = parseFloat(pattern1[1]);
      note = pattern1[2] ? pattern1[2].trim() : "Purchase";
    } else if (pattern2) {
      note = pattern2[1].trim();
      amount = parseFloat(pattern2[2]);
    } else {
      // Fallback extraction
      const numMatch = clean.match(/\$?(\d+(?:\.\d+)?)/);
      if (numMatch) {
        amount = parseFloat(numMatch[1]);
        note = clean.replace(numMatch[0], "").replace(/(?:spent|paid|on|for)/gi, "").trim() || "Item";
      }
    }

    // Categorize
    const noteLower = note.toLowerCase();
    if (noteLower.match(/lunch|dinner|breakfast|food|coffee|burger|pizza|sushi|groceries|snack|drink/)) {
      category = "Food & Drink";
    } else if (noteLower.match(/uber|lyft|gas|transit|metro|taxi|flight|train/)) {
      category = "Transportation";
    } else if (noteLower.match(/bill|rent|wifi|electric|water|subscription|netflix|spotify/)) {
      category = "Bills & Utilities";
    } else if (noteLower.match(/amazon|clothes|shoes|target|shopping|books/)) {
      category = "Shopping";
    }

    const res = this.memory.addExpense(userId, amount, category, note);

    return {
      reply: `💳 EXPENSE LOGGED:
• Amount: $${res.expense.amount.toFixed(2)} (${category})
• Note: "${res.expense.note}"
────────────────────
💰 Today's Total: $${res.dailyTotal.toFixed(2)}
🎯 Remaining Daily Budget: $${res.remainingBudget.toFixed(2)}`,
      tapback: "like",
      intent: "EXPENSE_TRACK",
      modelUsed: "tracker-expense",
      latencyMs: Date.now() - start,
    };
  }

  handleHabit(userId: string, userText: string): AgentResponse {
    const start = Date.now();
    const clean = userText.trim().toLowerCase();

    // 1. Query habits list
    if (clean === "habits" || clean === "my habits" || clean === "habit streaks") {
      const habits = this.memory.getHabits(userId);
      if (habits.length === 0) {
        return {
          reply: `🔥 YOUR HABIT STREAKS:
You haven't logged any habit streaks yet.
Start one anytime by texting:
• "Gym done"
• "Read 20 pages"
• "Meditated"`,
          tapback: "like",
          intent: "HABIT_LOG",
          modelUsed: "tracker-habit",
          latencyMs: Date.now() - start,
        };
      }

      const list = habits.map((h) => `• ${h.name}: ${h.streak} day streak 🔥 (Last: ${h.lastCompletedDate || "Today"})`).join("\n");
      return {
        reply: `🔥 YOUR HABIT STREAKS:\n${list}\n\nKeep the momentum going! Don't break the chain! 🌟`,
        tapback: "love",
        intent: "HABIT_LOG",
        modelUsed: "tracker-habit",
        latencyMs: Date.now() - start,
      };
    }

    // 2. Log habit completion
    let habitName = clean
      .replace(/^(?:habit:\s*|habit done:\s*|logged habit:\s*)/i, "")
      .replace(/\s*(?:done|finished|completed)$/i, "")
      .trim();

    if (!habitName) habitName = "Daily Habit";
    // Capitalize first letter of each word
    const formattedName = habitName
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    const res = this.memory.logHabit(userId, formattedName);

    return {
      reply: `🔥 HABIT LOGGED: "${res.habit.name}"!
────────────────────
🏆 Current Streak: ${res.habit.streak} day${res.habit.streak > 1 ? "s" : ""} in a row!
${res.habit.streak > 1 ? "Incredible consistency—don't break the chain!" : "Awesome start! Every great streak begins on day 1."} 🚀`,
      tapback: "love",
      effect: "fireworks",
      intent: "HABIT_LOG",
      modelUsed: "tracker-habit",
      latencyMs: Date.now() - start,
    };
  }

  handleHydration(userId: string, userText: string): AgentResponse {
    const start = Date.now();
    const clean = userText.trim().toLowerCase();

    // Check if query only
    if (clean === "hydration") {
      const status = this.memory.getHydration(userId);
      const totalBars = 10;
      const filled = Math.round((status.percent / 100) * totalBars);
      const bar = "■".repeat(filled) + "□".repeat(Math.max(0, totalBars - filled));

      return {
        reply: `💧 HYDRATION STATUS:
[${bar}] ${status.percent}%
• Current: ${status.currentMl} / ${status.targetMl} ml
• Remaining: ${Math.max(0, status.targetMl - status.currentMl)} ml
Tip: Text "💧" or "water" after drinking a glass to log +250ml!`,
        tapback: "like",
        intent: "HYDRATION_LOG",
        modelUsed: "tracker-water",
        latencyMs: Date.now() - start,
      };
    }

    // Parse ml if specified (e.g. "drank 500ml")
    let amount = 250;
    const mlMatch = clean.match(/(\d+)\s*ml/);
    if (mlMatch) {
      amount = parseInt(mlMatch[1], 10);
    }

    const status = this.memory.addHydration(userId, amount);
    const totalBars = 10;
    const filled = Math.round((status.percent / 100) * totalBars);
    const bar = "■".repeat(filled) + "□".repeat(Math.max(0, totalBars - filled));

    const cheer =
      status.percent >= 100
        ? "🎉 Daily hydration goal achieved! Great job keeping yourself healthy!"
        : "Keep drinking throughout the day to stay sharp and energized! ⚡";

    return {
      reply: `💧 HYDRATION LOGGED (+${amount}ml)
────────────────────
[${bar}] ${status.percent}%
• Current: ${status.currentMl} / ${status.targetMl} ml
${cheer}`,
      tapback: "like",
      intent: "HYDRATION_LOG",
      modelUsed: "tracker-water",
      latencyMs: Date.now() - start,
    };
  }
}
