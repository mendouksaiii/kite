import { Reminder } from "../scheduler.js";

export type AgentIntent =
  | "MATH_SPLIT"
  | "UNIT_CONVERT"
  | "EXPENSE_TRACK"
  | "HABIT_LOG"
  | "HYDRATION_LOG"
  | "FOCUS_SPRINT"
  | "TASK_ACK"
  | "TIME_QUERY"
  | "SET_REMINDER"
  | "DAILY_BRIEF"
  | "GHOSTWRITE"
  | "LINK_SUMMARY"
  | "WEB_SEARCH"
  | "VOICE_NOTE"
  | "VISION_DOC"
  | "COMPANION_CHAT";

export interface InboundMedia {
  mimeType: string;
  data: Buffer;
}

export interface AgentResponse {
  reply: string;
  tapback?: "love" | "like" | "dislike" | "laugh" | "emphasize" | "question";
  effect?: "slam" | "gentle" | "invisible" | "loud" | "confetti" | "fireworks";
  scheduledReminder?: Reminder;
  voiceNoteParsed?: boolean;
  intent: AgentIntent;
  modelUsed: string;
  latencyMs: number;
}
