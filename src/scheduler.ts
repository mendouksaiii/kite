import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REMINDERS_FILE = path.resolve(__dirname, "../reminders.json");

export interface Reminder {
  id: string;
  userId: string;
  text: string;
  dueAt: number; // timestamp in ms
  status: "PENDING" | "TRIGGERED" | "ACKNOWLEDGED" | "CANCELLED";
  isAlarm: boolean;
  createdAt: string;
}

export type ReminderCallback = (reminder: Reminder) => Promise<void>;

export class SchedulerService {
  private reminders: Reminder[] = [];
  private timer: NodeJS.Timeout | null = null;
  private onDueCallback?: ReminderCallback;

  constructor() {
    this.load();
    this.startLoop();
  }

  setCallback(cb: ReminderCallback) {
    this.onDueCallback = cb;
  }

  schedule(
    userId: string,
    text: string,
    delayMinutes: number,
    isAlarm: boolean = false
  ): Reminder {
    const dueAt = Date.now() + Math.max(0.5, delayMinutes) * 60 * 1000;
    const reminder: Reminder = {
      id: "rem_" + Math.random().toString(36).substring(2, 9),
      userId,
      text: text.trim(),
      dueAt,
      status: "PENDING",
      isAlarm,
      createdAt: new Date().toISOString(),
    };

    this.reminders.push(reminder);
    this.save();
    console.log(
      `[Scheduler] Scheduled reminder for ${userId} in ${delayMinutes}m ("${reminder.text}")`
    );
    return reminder;
  }

  scheduleAt(
    userId: string,
    text: string,
    targetDate: Date,
    isAlarm: boolean = false
  ): Reminder {
    const dueAt = targetDate.getTime();
    const reminder: Reminder = {
      id: "rem_" + Math.random().toString(36).substring(2, 9),
      userId,
      text: text.trim(),
      dueAt,
      status: "PENDING",
      isAlarm,
      createdAt: new Date().toISOString(),
    };

    this.reminders.push(reminder);
    this.save();
    console.log(
      `[Scheduler] Scheduled reminder for ${userId} at ${targetDate.toLocaleTimeString()} ("${reminder.text}")`
    );
    return reminder;
  }

  getActiveReminders(userId: string): Reminder[] {
    return this.reminders.filter(
      (r) => r.userId === userId && r.status === "PENDING"
    );
  }

  getAllReminders(userId: string): Reminder[] {
    return this.reminders
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.dueAt - a.dueAt);
  }

  getLatestTriggered(userId: string): Reminder | undefined {
    return this.reminders
      .filter((r) => r.userId === userId && r.status === "TRIGGERED")
      .sort((a, b) => b.dueAt - a.dueAt)[0];
  }

  getRemindersSummary(userId: string): string {
    const userReminders = this.getAllReminders(userId);
    if (userReminders.length === 0) {
      return "No reminders or timers on record.";
    }

    const now = Date.now();
    const lines = userReminders.slice(0, 8).map((r) => {
      const createdStr = new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const dueStr = new Date(r.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const diffMins = Math.round((r.dueAt - now) / 60000);

      if (r.status === "PENDING") {
        return `• [PENDING TIMER] "${r.text}" — Set at ${createdStr}, due at ${dueStr} (in ${Math.max(0, diffMins)}m)`;
      } else if (r.status === "TRIGGERED") {
        const minsAgo = Math.max(0, Math.round((now - r.dueAt) / 60000));
        return `• [TRIGGERED / ALARM FIRED] "${r.text}" — Fired ${minsAgo === 0 ? "just now" : `${minsAgo}m ago`} (scheduled for ${dueStr})`;
      } else if (r.status === "ACKNOWLEDGED") {
        return `• [COMPLETED] "${r.text}" — Checked off as finished.`;
      } else {
        return `• [CANCELLED] "${r.text}"`;
      }
    });

    return lines.join("\n");
  }

  markAcknowledged(reminderId: string): boolean {
    const r = this.reminders.find((item) => item.id === reminderId);
    if (r) {
      r.status = "ACKNOWLEDGED";
      this.save();
      return true;
    }
    return false;
  }

  cancelAll(userId: string): number {
    let count = 0;
    for (const r of this.reminders) {
      if (r.userId === userId && r.status === "PENDING") {
        r.status = "CANCELLED";
        count++;
      }
    }
    this.save();
    return count;
  }

  private startLoop() {
    this.timer = setInterval(() => this.checkDue(), 5000);
  }

  private async checkDue() {
    const now = Date.now();
    for (const r of this.reminders) {
      if (r.status === "PENDING" && r.dueAt <= now) {
        r.status = "TRIGGERED";
        this.save();
        console.log(`[Scheduler] ⏰ Reminder fired for ${r.userId}: "${r.text}"`);

        if (this.onDueCallback) {
          try {
            await this.onDueCallback(r);
          } catch (err) {
            console.error(`[Scheduler] Failed to execute callback for reminder ${r.id}:`, err);
          }
        }
      }
    }
  }

  private load() {
    try {
      if (fs.existsSync(REMINDERS_FILE)) {
        const raw = fs.readFileSync(REMINDERS_FILE, "utf-8");
        this.reminders = JSON.parse(raw);
      }
    } catch (err) {
      this.reminders = [];
    }
  }

  private save() {
    try {
      fs.writeFileSync(REMINDERS_FILE, JSON.stringify(this.reminders, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save reminders:", err);
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
