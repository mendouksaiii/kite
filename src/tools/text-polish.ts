export type ToneType = "POLITE_DECLINE" | "CONFIDENT_FOLLOWUP" | "CASUAL_WARM" | "CLEAR_BOUNDARIES";

export const TONE_TEMPLATES: Record<ToneType, string> = {
  POLITE_DECLINE: "Help the user politely but firmly say no to an invitation or request without over-explaining or feeling guilty.",
  CONFIDENT_FOLLOWUP: "Help the user follow up on a job, project, or email with crisp confidence, zero passivity, and professional enthusiasm.",
  CASUAL_WARM: "Draft a natural, friendly, non-awkward text to reach out to a friend, date, or colleague.",
  CLEAR_BOUNDARIES: "Help the user communicate a clear personal or professional boundary with calm grace.",
};
