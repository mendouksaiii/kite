import { ModelRouter } from "../model-router.js";
import { MemoryStore } from "../../memory.js";
import { AgentResponse } from "../types.js";
import { WebResearchService } from "../../tools/research.js";

export class AssistantAgent {
  private researchService: WebResearchService;

  constructor(
    private memory: MemoryStore,
    private modelRouter: ModelRouter
  ) {
    this.researchService = new WebResearchService();
  }

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
      pageText = await this.researchService.fetchPageText(url, 4000);
      if (!pageText) {
        pageText = `URL: ${url}. (Could not scrape full HTML, summarize based on URL slug).`;
      }
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

    // 1. Instant Weather Check via wttr.in
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
        // Fall through to full research
      }
    }

    // 2. Autonomous Internet Research via WebResearchService (DuckDuckGo + Wikipedia)
    let searchQuery = userText
      .replace(/^(?:search for|search|lookup|look up|research|can you research|find out|google:?)\s+/i, "")
      .replace(/\b(?:and\s+)?(?:stop guessing|don't guess|dont guess|no guessing|check online|look it up)\b/gi, "")
      .trim();

    // Context resolution: if searchQuery is empty, vague ("it", "that", "the latest"), or was just a directive ("stop guessing")
    if (
      !searchQuery ||
      searchQuery.length < 4 ||
      /^(it|that|this|the latest|the latest one|its price|the price)$/i.test(searchQuery)
    ) {
      const history = this.memory.getHistory(userId);
      const userMsgs = history.filter((m) => m.role === "user");
      // Search backwards for the substantive question
      for (let i = userMsgs.length - 1; i >= 0; i--) {
        const prevText = (userMsgs[i].content || "").trim();
        const cleanedPrev = prevText
          .replace(/^(?:search for|search|lookup|look up|research|can you research|find out|google:?)\s+/i, "")
          .replace(/\b(?:and\s+)?(?:stop guessing|don't guess|dont guess|no guessing|check online|look it up)\b/gi, "")
          .trim();
        if (cleanedPrev.length >= 4 && !cleanedPrev.toLowerCase().includes("stop guessing")) {
          searchQuery = cleanedPrev;
          break;
        }
      }
    }

    if (!searchQuery) {
      searchQuery = userText;
    }

    console.log(`[AssistantAgent] Performing live web research for: "${searchQuery}"`);
    const findings = await this.researchService.research(searchQuery);

    const prompt = `You are Kite, an empathetic, helpful, and highly accurate human companion on Apple iMessage.
The user asked you a question requiring real-time internet research:
"${userText}" (Resolved Topic: "${searchQuery}")

Here are the latest live web search findings retrieved from the internet:
${findings.evidenceText}

CRITICAL INSTRUCTIONS:
1. Base your answer strictly on the verified live search findings above.
2. NEVER guess, extrapolate, or invent future models, releases, or prices based on the calendar year (e.g. do NOT invent an iPhone 18 or 19). If an item has not been released yet, state what the current confirmed released model is and what rumors/expected dates exist.
3. If the user asked you to "stop guessing" or verify facts, address their underlying question directly with the real verified facts from the search findings.
4. Naturally mention key facts or sources (e.g. "According to reports...", "Apple's latest confirmed release is...").
5. Keep the formatting clean and readable on an iPhone screen (2 to 4 sentences).

Format as JSON:
{
  "reply": "Your researched answer here",
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
      reply: parsed.reply || `Here is what I found online regarding "${searchQuery}":\n\n${findings.results[0]?.snippet || "I verified the latest information for you."}`,
      tapback: parsed.tapback || "like",
      intent: "WEB_SEARCH",
      modelUsed: `web-research (${modelRes.modelUsed})`,
      latencyMs: Date.now() - start,
    };
  }
}
