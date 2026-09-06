import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { UserContext, ChatMessage } from "./persona.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_FILE = path.resolve(__dirname, "../memory.json");

export interface Habit {
  id: string;
  name: string;
  streak: number;
  lastCompletedDate?: string;
}

export interface UserProfile {
  id: string;
  name?: string;
  facts: string[];
  habits: Habit[];
  recentTopics: string[];
  history: ChatMessage[];
  completedTasks: number;
  createdAt: string;
  updatedAt: string;
}

export class MemoryStore {
  private profiles: Record<string, UserProfile> = {};

  constructor() {
    this.load();
  }

  getProfile(userId: string): UserProfile {
    if (!this.profiles[userId]) {
      this.profiles[userId] = {
        id: userId,
        facts: [],
        habits: [],
        recentTopics: [],
        history: [],
        completedTasks: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.save();
    }
    // Ensure history array exists
    if (!this.profiles[userId].history) {
      this.profiles[userId].history = [];
    }
    return this.profiles[userId];
  }

  getUserContext(
    userId: string,
    activeRemindersCount: number = 0,
    remindersContext?: string
  ): UserContext {
    const p = this.getProfile(userId);

    // If name is not explicitly set, try extracting from facts
    let inferredName = p.name;
    if (!inferredName) {
      for (const f of p.facts) {
        const nameMatch = f.match(/(?:user's name is|my name is|name is)\s+([A-Za-z]+)/i);
        if (nameMatch) {
          inferredName = nameMatch[1];
          p.name = inferredName;
          break;
        }
      }
    }

    const now = new Date();
    const currentTimeStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }) + " at " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    return {
      userId,
      name: inferredName,
      facts: p.facts,
      recentTopics: p.recentTopics.slice(-5),
      activeRemindersCount,
      completedTasksCount: p.completedTasks,
      currentTimeStr,
      remindersContext,
      conversationHistory: p.history || [],
    };
  }

  setName(userId: string, name: string) {
    const p = this.getProfile(userId);
    p.name = name;
    p.updatedAt = new Date().toISOString();
    this.save();
  }

  addFact(userId: string, fact: string) {
    const p = this.getProfile(userId);
    const clean = fact.trim();
    if (!clean) return;

    // Check if fact contains name
    const nameMatch = clean.match(/(?:user's name is|my name is|name is)\s+([A-Za-z]+)/i);
    if (nameMatch && !p.name) {
      p.name = nameMatch[1];
    }

    // Avoid duplicate facts
    const lower = clean.toLowerCase();
    const exists = p.facts.some((f) => f.toLowerCase() === lower || f.toLowerCase().includes(lower));
    if (!exists) {
      p.facts.push(clean);
      p.updatedAt = new Date().toISOString();
      this.save();
    }
  }

  addFacts(userId: string, facts: string[]) {
    for (const f of facts) {
      this.addFact(userId, f);
    }
  }

  addHistory(userId: string, role: "user" | "kite", content: string) {
    const p = this.getProfile(userId);
    if (!p.history) p.history = [];
    p.history.push({
      role,
      content: content.trim(),
      timestamp: new Date().toISOString(),
    });
    // Keep last 30 messages for deep conversational memory
    if (p.history.length > 30) {
      p.history = p.history.slice(-30);
    }
    p.updatedAt = new Date().toISOString();
    this.save();
  }

  getHistory(userId: string): ChatMessage[] {
    return this.getProfile(userId).history || [];
  }

  recordTopic(userId: string, topic: string) {
    const p = this.getProfile(userId);
    p.recentTopics.push(topic);
    if (p.recentTopics.length > 20) {
      p.recentTopics = p.recentTopics.slice(-20);
    }
    p.updatedAt = new Date().toISOString();
    this.save();
  }

  incrementCompletedTasks(userId: string) {
    const p = this.getProfile(userId);
    p.completedTasks = (p.completedTasks || 0) + 1;
    p.updatedAt = new Date().toISOString();
    this.save();
  }

  private load() {
    try {
      if (fs.existsSync(MEMORY_FILE)) {
        const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
        this.profiles = JSON.parse(raw);
      }
    } catch (err) {
      console.warn("Failed to load memory store, initializing empty:", err);
      this.profiles = {};
    }
  }

  private save() {
    try {
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.profiles, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save memory store:", err);
    }
  }
}
