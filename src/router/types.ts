import { Reminder } from "../scheduler.js";

export type AgentIntent =
  | "MATH_SPLIT"
  | "TASK_ACK"
  | "TIME_QUERY"
  | "SET_REMINDER"
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
