export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

export interface ResearchFindings {
  query: string;
  results: SearchResult[];
  evidenceText: string;
  sources: string[];
}

export class WebResearchService {
  /**
   * Searches the live web using DuckDuckGo HTML search.
   */
  async searchDuckDuckGo(query: string, limit = 5): Promise<SearchResult[]> {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[WebResearch] DuckDuckGo returned HTTP ${res.status}`);
        return [];
      }

      const html = await res.text();
      const snippets = [...html.matchAll(/class="result__snippet[^>]*>([\s\S]*?)<\/a>/g)];
      const urls = [...html.matchAll(/class="result__url"[^>]*>([\s\S]*?)<\/span>/g)];

      const results: SearchResult[] = [];
      for (let i = 0; i < Math.min(snippets.length, limit); i++) {
        const text = snippets[i][1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        const rawUrl = urls[i] ? urls[i][1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
        const cleanDomain = rawUrl.split(" ")[0].replace(/^https?:\/\//, "");

        if (text) {
          results.push({
            title: `Web Result ${i + 1}`,
            snippet: text,
            url: rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`,
            source: cleanDomain || "Web",
          });
        }
      }
      return results;
    } catch (err: any) {
      console.warn("[WebResearch] DuckDuckGo search error:", err.message);
      return [];
    }
  }

  /**
   * Queries Wikipedia API for encyclopedic topics.
   */
  async searchWikipedia(topic: string): Promise<SearchResult | null> {
    try {
      const clean = topic
        .replace(/^(?:who is|who was|what is|what are|explain|tell me about)\s+/i, "")
        .replace(/[?.,!]/g, "")
        .trim();

      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "KiteCompanion/1.0 (imessage@photon.codes)" },
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) return null;
      const data = (await res.json()) as any;
      if (data.extract) {
        return {
          title: data.title || clean,
          snippet: data.extract,
          url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(clean)}`,
          source: "Wikipedia",
        };
      }
      return null;
    } catch (err: any) {
      return null;
    }
  }

  /**
   * Fetches the clean readable text from a URL.
   */
  async fetchPageText(url: string, maxChars = 3000): Promise<string> {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        },
        signal: AbortSignal.timeout(6000),
      });
      const html = await res.text();
      return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, maxChars);
    } catch (err: any) {
      console.warn(`[WebResearch] Failed to fetch page ${url}:`, err.message);
      return "";
    }
  }

  /**
   * Conducts full multi-source research for a query.
   */
  async research(query: string): Promise<ResearchFindings> {
    console.log(`[WebResearch] Conducting live internet research for: "${query}"`);

    // Run DuckDuckGo search & Wikipedia query in parallel
    const [webResults, wikiResult] = await Promise.all([
      this.searchDuckDuckGo(query, 5),
      this.searchWikipedia(query),
    ]);

    const combinedResults: SearchResult[] = [];
    if (wikiResult) {
      combinedResults.push(wikiResult);
    }
    for (const r of webResults) {
      if (!combinedResults.some((c) => c.snippet === r.snippet)) {
        combinedResults.push(r);
      }
    }

    const sources = Array.from(new Set(combinedResults.map((r) => r.source))).filter(Boolean);

    const evidenceText =
      combinedResults.length > 0
        ? combinedResults
            .map((r, i) => `[Source ${i + 1}: ${r.source} (${r.url})]\n${r.snippet}`)
            .join("\n\n")
        : "No external search snippets returned. Use verified knowledge.";

    return {
      query,
      results: combinedResults,
      evidenceText,
      sources,
    };
  }
}
