import { AgentIntent, InboundMedia } from "./types.js";

export function classifyIntent(
  userText: string,
  media?: InboundMedia
): AgentIntent {
  // 1. Media attachments take first precedence
  if (media) {
    if (media.mimeType.startsWith("audio/") || media.mimeType.includes("audio")) {
      return "VOICE_NOTE";
    }
    if (media.mimeType.startsWith("image/")) {
      return "VISION_DOC";
    }
  }

  const clean = (userText || "").trim().toLowerCase();

  // 2. Links & URLs for Instant Article TL;DR Summarization
  if (clean.match(/https?:\/\/[^\s]+/i)) {
    return "LINK_SUMMARY";
  }

  // 3. Hydration / Water Counter
  if (
    clean === "💧" ||
    clean === "water" ||
    clean === "+1 water" ||
    clean === "drink water" ||
    clean === "drank water" ||
    clean === "log water" ||
    clean === "hydration" ||
    clean.includes("drank water") ||
    clean.includes("glass of water")
  ) {
    return "HYDRATION_LOG";
  }

  // 4. Focus & Pomodoro Sprints
  if (
    clean.match(/^(?:focus|pomodoro|sprint)(?:\s+(\d+))?$/i) ||
    clean.startsWith("start pomodoro") ||
    clean.startsWith("start focus")
  ) {
    return "FOCUS_SPRINT";
  }

  // 5. Daily Briefing & Nightly Wind-Down
  if (
    clean.includes("morning briefing") ||
    clean.includes("daily brief") ||
    clean.includes("daily briefing") ||
    clean.includes("nightly recap") ||
    clean.includes("wind down") ||
    clean === "briefing" ||
    clean === "brief"
  ) {
    return "DAILY_BRIEF";
  }

  // 6. Unit & Currency Conversions (Deterministic 1ms)
  if (
    clean.match(/\d+(?:\.\d+)?\s*(?:eur|usd|gbp|cad|aud|jpy|ngn)\s+(?:to|in)\s+(?:eur|usd|gbp|cad|aud|jpy|ngn)/i) ||
    clean.match(/\d+(?:\.\d+)?\s*(?:lbs?|pounds?|kg|kilos?|kilograms?|miles?|km|kilometers?|feet|ft|inches?|in|cm|centimeters?|celsius|fahrenheit|f|c|oz|grams?)\s+(?:to|in)\s+(?:lbs?|pounds?|kg|kilos?|kilograms?|miles?|km|kilometers?|feet|ft|inches?|in|cm|centimeters?|celsius|fahrenheit|f|c|oz|grams?)/i) ||
    clean.match(/^convert\s+\d+/i)
  ) {
    return "UNIT_CONVERT";
  }

  // 7. Math & Bill Splitting
  if (
    clean.match(/split\s+\$?(\d+(?:\.\d+)?)\s+(\d+)\s*(?:ways|people)?/i) ||
    clean.match(/bill\s+split/i) ||
    clean.match(/tip\s+calculator/i)
  ) {
    return "MATH_SPLIT";
  }

  // 8. Expense & Spending Tracker
  if (
    clean.match(/(?:spent|paid|cost|bought)\s+\$?(\d+(?:\.\d+)?)/i) ||
    clean.match(/^(?:uber|lyft|groceries|dinner|lunch|coffee|breakfast|target|amazon)\s+\$?(\d+(?:\.\d+)?)/i) ||
    clean === "expenses" ||
    clean === "spending" ||
    clean === "my expenses" ||
    clean === "budget" ||
    clean === "what did i spend"
  ) {
    return "EXPENSE_TRACK";
  }

  // 9. Habit Streaks & Accountability
  if (
    clean.startsWith("gym done") ||
    clean.includes("read 20 pages") ||
    clean.includes("meditated") ||
    clean.startsWith("habit done") ||
    clean.startsWith("habit:") ||
    clean === "habits" ||
    clean === "my habits" ||
    clean === "habit streaks" ||
    clean.match(/^(?:logged|checked off|completed|finished)\s+habit/i)
  ) {
    return "HABIT_LOG";
  }

  // 10. Ghostwriting & Message Drafting
  if (
    clean.startsWith("draft a") ||
    clean.startsWith("draft:") ||
    clean.startsWith("write a reply") ||
    clean.startsWith("how should i reply") ||
    clean.startsWith("how should i text") ||
    clean.includes("draft a message") ||
    clean.includes("draft a text") ||
    clean.includes("draft a decline")
  ) {
    return "GHOSTWRITE";
  }

  // 11. Live Web & Research Search
  if (
    clean.startsWith("search") ||
    clean.startsWith("look up") ||
    clean.startsWith("lookup") ||
    clean.startsWith("research") ||
    clean.startsWith("find out") ||
    clean.startsWith("google") ||
    clean.startsWith("weather in") ||
    clean.startsWith("what's the weather") ||
    clean.startsWith("what is the weather") ||
    clean.startsWith("who won") ||
    clean.startsWith("who is") ||
    clean.startsWith("who was") ||
    clean.startsWith("what is the latest on") ||
    clean.startsWith("what's the latest on") ||
    clean.startsWith("latest news on") ||
    clean.startsWith("what happened to") ||
    clean.startsWith("tell me about") ||
    clean.includes("search the web") ||
    clean.includes("look up on the internet") ||
    clean.includes("research on the web") ||
    clean.match(/^is\s+.+\s+(?:open|closed)/i)
  ) {
    return "WEB_SEARCH";
  }

  // 12. Task Completion / Done Acknowledgments
  if (
    clean === "done" ||
    clean === "i did it" ||
    clean === "finished" ||
    clean === "completed" ||
    clean.startsWith("done with") ||
    clean === "checked off" ||
    clean === "all done"
  ) {
    return "TASK_ACK";
  }

  // 13. Time & Schedule Status Queries
  if (
    clean === "!reminders" ||
    clean === "reminders" ||
    clean === "what are my reminders" ||
    clean.includes("on my schedule") ||
    clean.includes("anything on my schedule") ||
    clean.includes("what's on my schedule") ||
    clean.includes("do i have anything") ||
    clean.includes("has it already been") ||
    clean.includes("has it been") ||
    clean.includes("how much time is left") ||
    clean.includes("what time is it")
  ) {
    return "TIME_QUERY";
  }

  // 14. Setting Reminders / Alarms
  if (
    clean.startsWith("remind me") ||
    clean.startsWith("set a reminder") ||
    clean.startsWith("set reminder") ||
    clean.startsWith("set an alarm") ||
    clean.startsWith("set alarm") ||
    clean.startsWith("wake me up") ||
    clean.startsWith("ping me in") ||
    clean.includes("remind me to") ||
    clean.includes("remind me in")
  ) {
    return "SET_REMINDER";
  }

  // 15. Default: Rich Human-to-Human Companion Chat
  return "COMPANION_CHAT";
}

export class IntentDetector {
  detect(userText: string, media?: InboundMedia): AgentIntent {
    return classifyIntent(userText, media);
  }
}
