import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { config } from "../config.js";
import { InboundMedia } from "./types.js";
import { ChatMessage } from "../persona.js";

export interface ModelCallResult {
  rawText: string;
  modelUsed: string;
  latencyMs: number;
}

export class ModelRouter {
  private gemini: GoogleGenerativeAI;
  private groq: Groq;

  constructor() {
    this.gemini = new GoogleGenerativeAI(config.gemini.apiKey);
    this.groq = new Groq({ apiKey: config.groq.apiKey });
  }

  async callGemini(
    systemPrompt: string,
    userText: string,
    history?: ChatMessage[],
    media?: InboundMedia
  ): Promise<ModelCallResult> {
    const start = Date.now();
    const model = this.gemini.getGenerativeModel({
      model: config.gemini.model,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.8,
      },
      systemInstruction: systemPrompt,
    });

    let rawText = "";

    // If media is present, use multimodal parts
    if (media) {
      const parts: any[] = [
        {
          inlineData: {
            mimeType: media.mimeType,
            data: media.data.toString("base64"),
          },
        },
        {
          text: userText || "Analyze this media and summarize / triage action items for me.",
        },
      ];
      const res = await model.generateContent(parts);
      rawText = res.response.text();
    } else {
      // Build history
      const geminiHistory: any[] = [];
      for (const msg of (history || []).slice(-10)) {
        const role = msg.role === "kite" ? "model" : "user";
        if (geminiHistory.length > 0 && geminiHistory[geminiHistory.length - 1].role === role) {
          geminiHistory[geminiHistory.length - 1].parts[0].text += "\n" + msg.content;
        } else {
          geminiHistory.push({
            role,
            parts: [{ text: msg.content }],
          });
        }
      }
      if (geminiHistory.length > 0 && geminiHistory[0].role === "model") {
        geminiHistory.shift();
      }

      if (geminiHistory.length > 0) {
        const chat = model.startChat({ history: geminiHistory });
        const res = await chat.sendMessage(userText);
        rawText = res.response.text();
      } else {
        const res = await model.generateContent(userText);
        rawText = res.response.text();
      }
    }

    return {
      rawText,
      modelUsed: "gemini-2.5-flash",
      latencyMs: Date.now() - start,
    };
  }

  async callGroq(
    systemPrompt: string,
    userText: string,
    history?: ChatMessage[]
  ): Promise<ModelCallResult> {
    const start = Date.now();
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-10).map((m) => ({
        role: m.role === "kite" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
      { role: "user", content: userText },
    ];

    const completion = await this.groq.chat.completions.create({
      model: config.groq.model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const rawText = completion.choices[0]?.message?.content || "{}";
    return {
      rawText,
      modelUsed: "groq-llama-3.3-70b",
      latencyMs: Date.now() - start,
    };
  }

  async generateJson(
    systemPrompt: string,
    userText: string,
    history?: ChatMessage[],
    media?: InboundMedia
  ): Promise<ModelCallResult> {
    if (media) {
      return this.callGemini(systemPrompt, userText, history, media);
    }

    try {
      return await this.callGemini(systemPrompt, userText, history);
    } catch (geminiErr) {
      console.warn("[ModelRouter] Gemini failed, failing over to Groq:", geminiErr);
      return await this.callGroq(systemPrompt, userText, history);
    }
  }
}
