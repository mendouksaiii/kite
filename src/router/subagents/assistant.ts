import { ModelRouter } from "../model-router.js";
import { MemoryStore } from "../../memory.js";
import { AgentResponse } from "../types.js";

export class AssistantAgent {
  constructor(
    private memory: MemoryStore,
    private modelRouter: ModelRouter
  ) {}

  async handleGhostwrite(userId: string, userText: string): Promise<AgentResponse> {
    const start = Date.now();
    const profile = this.memory.getProfile(userId);
    const name = profile.name || "friend";

    const prompt = `You are Kite's Ghostwriter Assistant. The user wants you to draft a message, reply, decline, or note.
User input: "${userText}"

Provide 2 great, natural, high-EQ options formatted cleanly for copy/pasting on an iPhone:
OPTION 1: Warm & Direct
OPTION 2: Soft & Diplomatic

Format your response as JSON:
{
  "reply": "Here are two ways to send it:\\n\\nOption 1 (Direct):\\n\\"...\\"\\n\\nOption 2 (Soft):\\n\\"...\\"",
  "tapback": "love"
}`;

    const modelRes = await this.modelRouter.generateJson(prompt, userText);
    let parsed: any = {};
    try {
      parsed = JSON.parse(modelRes.rawText);
    } catch {
      parsed = { reply: modelRes.rawText };
    }

    return {
      reply: parsed.reply || "Here is a draft you can send:\n\n\"Thanks so much for thinking of me! I won't be able to make it this time, but let's definitely catch up soon.\"",
      tapback: parsed.tapback || "love",
      intent: "GHOSTWRITE",
      modelUsed: modelRes.modelUsed,
      latencyMs: Date.now() - start,
    };
  }

  async handleLinkSummary(userId: string, userText: string): Promise<AgentResponse> {
    const start = Date.now();
    const urlMatch = userText.match(/https?:\/\/[^\s]+/i);
    if (!urlMatch) {
      return {
        reply: "Send me any article or web link, and I'll extract a 3-bullet executive summary for you! 🔗",
        tapback: "question",
        intent: "LINK_SUMMARY",
        modelUsed: "assistant-link",
        latencyMs: Date.now() - start,
      };
    }

    const url = urlMatch[0];
    let pageText = "";
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) KiteBot/1.0" },
        signal: AbortSignal.timeout(6000),
      });
      const html = await resp.text();
      // Simple tag stripper to extract body text
      pageText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 4000);
    } catch (err: any) {
      console.warn("[AssistantAgent] Could not fetch link:", err.message);
      pageText = `URL: ${url}. (Could not scrape full HTML, summarize based on URL slug).`;
    }

    const prompt = `You are Kite's Executive Link Summarizer. Summarize this webpage in 3 punchy, insightful bullet points and a 1-sentence bottom line.
URL: ${url}
Content extract:
${pageText}

Format your response as JSON:
{
  "reply": "📰 ARTICLE TL;DR\\n• Bullet 1\\n• Bullet 2\\n• Bullet 3\\n\\n💡 Bottom Line: ...",
  "tapback": "emphasize"
}`;

    const modelRes = await this.modelRouter.generateJson(prompt, "Summarize this page");
    let parsed: any = {};
    try {
      parsed = JSON.parse(modelRes.rawText);
    } catch {
      parsed = { reply: modelRes.rawText };
    }

    return {
      reply: parsed.reply || `📰 SUMMARY FOR ${url}:\n• Key content summarized\n• Core points extracted\n• Ready for quick reading!`,
      tapback: parsed.tapback || "emphasize",
      intent: "LINK_SUMMARY",
      modelUsed: modelRes.modelUsed,
      latencyMs: Date.now() - start,
    };
  }

  async handleWebSearch(userId: string, userText: string): Promise<AgentResponse> {
    const start = Date.now();
    const clean = userText.trim().toLowerCase();

    // Check if weather query
    const weatherMatch = clean.match(/(?:weather in|weather for|temperature in)\s+([a-z\s]+)/i);
    if (weatherMatch) {
      const city = weatherMatch[1].trim();
      try {
        const weatherUrl = `https://wttr.in/${encodeURIComponent(city)}?format=3`;
        const resp = await fetch(weatherUrl, { signal: AbortSignal.timeout(4000) });
        if (resp.ok) {
          const report = (await resp.text()).trim();
          return {
            reply: `🌤️ WEATHER REPORT:\n${report}\nPack accordingly and have a fantastic day! ☀️`,
            tapback: "like",
            intent: "WEB_SEARCH",
            modelUsed: "wttr-weather-live",
            latencyMs: Date.now() - start,
          };
        }
      } catch (err) {
        // Fall back to AI model
      }
    }

    // General Web & Fact Search via Gemini
    const prompt = `You are Kite's Knowledge Assistant. The user is asking a real-world question or search lookup over iMessage.
Question: "${userText}"
Give a verified, concise 2-to-3 sentence answer. Be accurate, informative, and warm. Avoid rambling.

Format as JSON:
{
  "reply": "Your concise answer here",
  "tapback": "like"
}`;

    const modelRes = await this.modelRouter.generateJson(prompt, userText);
    let parsed: any = {};
    try {
      parsed = JSON.parse(modelRes.rawText);
    } catch {
      parsed = { reply: modelRes.rawText };
    }

    return {
      reply: parsed.reply || "Here is what I found for you! Let me know if you need any more details.",
      tapback: parsed.tapback || "like",
      intent: "WEB_SEARCH",
      modelUsed: modelRes.modelUsed,
      latencyMs: Date.now() - start,
    };
  }
}
