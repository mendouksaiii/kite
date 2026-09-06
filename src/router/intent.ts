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

  // 2. Math & Bill Splitting
  if (
    clean.match(/split\s+\$?(\d+(?:\.\d+)?)\s+(\d+)\s*(?:ways|people)?/i) ||
    clean.match(/bill\s+split/i) ||
    clean.match(/tip\s+calculator/i)
  ) {
    return "MATH_SPLIT";
  }

  // 3. Task Completion / Done Acknowledgments
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

  // 4. Time & Schedule Status Queries
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

  // 5. Setting Reminders / Alarms
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

// 6. Default: Rich Human-to-Human Companion Chat
  return "COMPANION_CHAT";
}

export class IntentDetector {
  detect(userText: string, media?: InboundMedia): AgentIntent {
    return classifyIntent(userText, media);
  }
}

