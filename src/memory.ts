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

export interface ExpenseItem {
  id: string;
  amount: number;
  category: string;
  note: string;
  timestamp: string;
}

export interface ImportantDate {
  id: string;
  name: string;
  dateIso: string;
  label: string;
}

export interface NutritionEntry {
  id: string;
  food: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  timestamp: string;
}

export interface UserProfile {
  id: string;
  name?: string;
  facts: string[];
  habits: Habit[];
  recentTopics: string[];
  history: ChatMessage[];
  completedTasks: number;
  expenses: ExpenseItem[];
  dailyBudget: number;
  hydrationTodayMl: number;
  lastHydrationDate: string;
  importantDates: ImportantDate[];
  nutritionLogs: NutritionEntry[];
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
        expenses: [],
        dailyBudget: 100,
        hydrationTodayMl: 0,
        lastHydrationDate: new Date().toISOString().slice(0, 10),
        importantDates: [],
        nutritionLogs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.save();
    }

    const p = this.profiles[userId];
    if (!p.history) p.history = [];
    if (!p.facts) p.facts = [];
    if (!p.habits) p.habits = [];
    if (!p.recentTopics) p.recentTopics = [];
    if (!p.expenses) p.expenses = [];
    if (!p.dailyBudget) p.dailyBudget = 100;
    if (typeof p.hydrationTodayMl !== "number") p.hydrationTodayMl = 0;
    if (!p.importantDates) p.importantDates = [];
    if (!p.nutritionLogs) p.nutritionLogs = [];

    // Reset daily hydration if it's a new day
    const today = new Date().toISOString().slice(0, 10);
    if (p.lastHydrationDate !== today) {
      p.hydrationTodayMl = 0;
      p.lastHydrationDate = today;
    }

    return p;
  }

  getUserContext(
    userId: string,
    activeRemindersCount: number = 0,
    remindersContext?: string
  ): UserContext {
    const p = this.getProfile(userId);

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
    const currentTimeStr =
      now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }) +
      " at " +
      now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

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

    const nameMatch = clean.match(/(?:user's name is|my name is|name is)\s+([A-Za-z]+)/i);
    if (nameMatch && !p.name) {
      p.name = nameMatch[1];
    }

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
    if (p.history.length > 30) {
      p.history = p.history.slice(-30);
    }
    p.updatedAt = new Date().toISOString();
    this.save();
  }

  getHistory(userId: string): ChatMessage[] {
    return this.getProfile(userId).history || [];
  }

  incrementCompletedTasks(userId: string) {
    const p = this.getProfile(userId);
    p.completedTasks = (p.completedTasks || 0) + 1;
    p.updatedAt = new Date().toISOString();
    this.save();
  }

  // --- EXPENSE TRACKER ---
  addExpense(
    userId: string,
    amount: number,
    category: string,
    note: string
  ): { expense: ExpenseItem; dailyTotal: number; remainingBudget: number } {
    const p = this.getProfile(userId);
    const item: ExpenseItem = {
      id: "exp_" + Math.random().toString(36).substring(2, 9),
      amount: Math.round(amount * 100) / 100,
      category: category || "General",
      note: note || "Expense",
      timestamp: new Date().toISOString(),
    };
    p.expenses.push(item);
    p.updatedAt = new Date().toISOString();
    this.save();

    const todayStr = new Date().toISOString().slice(0, 10);
    const dailyTotal = p.expenses
      .filter((e) => e.timestamp.slice(0, 10) === todayStr)
      .reduce((acc, curr) => acc + curr.amount, 0);

    const remainingBudget = Math.max(0, p.dailyBudget - dailyTotal);
    return { expense: item, dailyTotal, remainingBudget };
  }

  getTodayExpenses(userId: string): {
    items: ExpenseItem[];
    total: number;
    budget: number;
    remaining: number;
  } {
    const p = this.getProfile(userId);
    const todayStr = new Date().toISOString().slice(0, 10);
    const items = p.expenses.filter((e) => e.timestamp.slice(0, 10) === todayStr);
    const total = items.reduce((acc, curr) => acc + curr.amount, 0);
    return {
      items,
      total: Math.round(total * 100) / 100,
      budget: p.dailyBudget,
      remaining: Math.round(Math.max(0, p.dailyBudget - total) * 100) / 100,
    };
  }

  // --- HABIT STREAKS ---
  logHabit(userId: string, habitName: string): { habit: Habit; isNew: boolean } {
    const p = this.getProfile(userId);
    const clean = habitName.trim();
    const today = new Date().toISOString().slice(0, 10);
    let habit = p.habits.find((h) => h.name.toLowerCase() === clean.toLowerCase());

    let isNew = false;
    if (!habit) {
      isNew = true;
      habit = {
        id: "hab_" + Math.random().toString(36).substring(2, 9),
        name: clean,
        streak: 1,
        lastCompletedDate: today,
      };
      p.habits.push(habit);
    } else {
      if (habit.lastCompletedDate !== today) {
        habit.streak += 1;
        habit.lastCompletedDate = today;
      }
    }

    p.updatedAt = new Date().toISOString();
    this.save();
    return { habit, isNew };
  }

  getHabits(userId: string): Habit[] {
    return this.getProfile(userId).habits || [];
  }

  // --- HYDRATION ---
  addHydration(
    userId: string,
    amountMl: number = 250
  ): { currentMl: number; targetMl: number; percent: number } {
    const p = this.getProfile(userId);
    const targetMl = 2500;
    p.hydrationTodayMl = (p.hydrationTodayMl || 0) + amountMl;
    p.lastHydrationDate = new Date().toISOString().slice(0, 10);
    p.updatedAt = new Date().toISOString();
    this.save();

    const percent = Math.min(100, Math.round((p.hydrationTodayMl / targetMl) * 100));
    return { currentMl: p.hydrationTodayMl, targetMl, percent };
  }

  getHydration(userId: string): { currentMl: number; targetMl: number; percent: number } {
    const p = this.getProfile(userId);
    const targetMl = 2500;
    const currentMl = p.hydrationTodayMl || 0;
    const percent = Math.min(100, Math.round((currentMl / targetMl) * 100));
    return { currentMl, targetMl, percent };
  }

  // --- IMPORTANT DATES & BIRTHDAYS ---
  addImportantDate(userId: string, name: string, dateIso: string, label: string): ImportantDate {
    const p = this.getProfile(userId);
    const entry: ImportantDate = {
      id: "date_" + Math.random().toString(36).substring(2, 9),
      name,
      dateIso,
      label: label || "Event",
    };
    p.importantDates.push(entry);
    p.updatedAt = new Date().toISOString();
    this.save();
    return entry;
  }

  getUpcomingDates(userId: string, daysAhead: number = 7): ImportantDate[] {
    const p = this.getProfile(userId);
    const now = new Date();
    return (p.importantDates || []).filter((d) => {
      const target = new Date(d.dateIso);
      const diffMs = target.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= daysAhead;
    });
  }

  // --- NUTRITION LOGS ---
  logNutrition(
    userId: string,
    entry: Omit<NutritionEntry, "id" | "timestamp">
  ): NutritionEntry {
    const p = this.getProfile(userId);
    const item: NutritionEntry = {
      id: "nut_" + Math.random().toString(36).substring(2, 9),
      ...entry,
      timestamp: new Date().toISOString(),
    };
    p.nutritionLogs.push(item);
    p.updatedAt = new Date().toISOString();
    this.save();
    return item;
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
