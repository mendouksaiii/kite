import { calculateBillSplit, formatSplitMessage } from "../../tools/math.js";
import { AgentResponse } from "../types.js";

export class MicroToolAgent {
  handleBillSplit(userText: string): AgentResponse {
    const start = Date.now();
    const clean = userText.trim().toLowerCase();
    const splitMatch = clean.match(
      /split\s+\$?(\d+(?:\.\d+)?)\s+(\d+)\s*(?:ways|people)?(?:\s*(?:with|plus|\+)?\s*(\d+)%?\s*tip)?/i
    );

    if (splitMatch) {
      const amount = parseFloat(splitMatch[1]);
      const count = parseInt(splitMatch[2], 10);
      const tip = splitMatch[3] ? parseFloat(splitMatch[3]) : 18;
      const res = calculateBillSplit(amount, count, tip);
      return {
        reply: formatSplitMessage(res),
        tapback: "like",
        intent: "MATH_SPLIT",
        modelUsed: "deterministic-math",
        latencyMs: Date.now() - start,
      };
    }

    // Default fallback calculation if pattern was generic
    const res = calculateBillSplit(100, 2, 20);
    return {
      reply: formatSplitMessage(res),
      tapback: "like",
      intent: "MATH_SPLIT",
      modelUsed: "deterministic-math",
      latencyMs: Date.now() - start,
    };
  }
}
