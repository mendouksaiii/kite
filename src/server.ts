import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { KiteBrain } from "./brain.js";
import { SchedulerService } from "./scheduler.js";
import { MemoryStore } from "./memory.js";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "../public");

export class WebGateway {
  private server: http.Server;

  constructor(
    private brain: KiteBrain,
    private scheduler: SchedulerService,
    private memory: MemoryStore
  ) {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }

  start(port: number = 3001): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`🌐 Kite Web Gateway & Simulator running at http://localhost:${port}`);
        resolve(port);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    // --- API: CHAT ---
    if (url.pathname === "/api/chat" && req.method === "POST") {
      return this.handleChat(req, res);
    }

    // --- API: GET REMINDERS ---
    if (url.pathname.startsWith("/api/reminders/") && req.method === "GET") {
      const userId = decodeURIComponent(url.pathname.replace("/api/reminders/", ""));
      const active = this.scheduler.getActiveReminders(userId);
      const all = this.scheduler.getAllReminders(userId);
      return this.sendJson(res, { active, all });
    }

    // --- API: TOGGLE REMINDER ---
    if (url.pathname === "/api/reminders/toggle" && req.method === "POST") {
      try {
        const body = await this.readJsonBody(req);
        const { reminderId, userId } = body;
        if (reminderId) {
          this.scheduler.markAcknowledged(reminderId);
          if (userId) {
            this.memory.incrementCompletedTasks(userId);
          }
          return this.sendJson(res, { success: true });
        }
        return this.sendJson(res, { error: "Missing reminderId" }, 400);
      } catch (err: any) {
        return this.sendJson(res, { error: err.message }, 500);
      }
    }

    // --- API: GET MEMORY LORE ---
    if (url.pathname.startsWith("/api/memory/") && req.method === "GET") {
      const userId = decodeURIComponent(url.pathname.replace("/api/memory/", ""));
      const profile = this.memory.getProfile(userId);
      return this.sendJson(res, profile);
    }

    // --- API: GET TRACKER DATA ---
    if (url.pathname.startsWith("/api/tracker/") && req.method === "GET") {
      const userId = decodeURIComponent(url.pathname.replace("/api/tracker/", ""));
      const expenses = this.memory.getTodayExpenses(userId);
      const habits = this.memory.getHabits(userId);
      const hydration = this.memory.getHydration(userId);
      const profile = this.memory.getProfile(userId);
      return this.sendJson(res, { expenses, habits, hydration, profile });
    }

    // --- API: REGISTER PHONE WITH PHOTON ---
    if (url.pathname === "/api/register" && req.method === "POST") {
      return this.handleRegister(req, res);
    }

    // --- API: SYSTEM STATUS ---
    if (url.pathname === "/api/status" && req.method === "GET") {
      return this.sendJson(res, {
        name: "Kite",
        role: "Proactive Human Companion for iMessage",
        framework: "Photon Spectrum (spectrum-ts)",
        uptimeSeconds: Math.floor(process.uptime()),
        projectId: config.spectrum.projectId,
      });
    }

    // --- STATIC FILES (Web App UI) ---
    let filePath = path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC_DIR, "index.html");
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css",
        ".js": "application/javascript",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".json": "application/json",
      };
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
      return fs.createReadStream(filePath).pipe(res);
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }

  private async handleChat(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const body = await this.readJsonBody(req);
      const userText = (body.message || "").trim();
      const userId = body.userId || "web_guest";
      const media = body.media
        ? {
            mimeType: body.media.mimeType,
            data: Buffer.from(body.media.base64, "base64"),
          }
        : undefined;

      const kiteResp = await this.brain.processMessage(userId, userText, media);
      const activeReminders = this.scheduler.getActiveReminders(userId);
      const memoryProfile = this.memory.getProfile(userId);
      const expenses = this.memory.getTodayExpenses(userId);
      const habits = this.memory.getHabits(userId);
      const hydration = this.memory.getHydration(userId);

      return this.sendJson(res, {
        ...kiteResp,
        activeReminders,
        memoryProfile,
        expenses,
        habits,
        hydration,
      });
    } catch (err: any) {
      console.error("[WebGateway] Chat error:", err);
      return this.sendJson(res, { reply: "I had a momentary glitch, but I'm right here! What's on your mind?", error: err.message }, 500);
    }
  }

  private async handleRegister(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const body = await this.readJsonBody(req);
      const phone = (body.phoneNumber || body.phone || "").trim();
      const name = (body.name || body.firstName || "Friend").trim();

      if (!phone) {
        return this.sendJson(res, { error: "Phone number is required." }, 400);
      }

      const formatted = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
      console.log(`[WebGateway] Registering tester phone with Photon Spectrum: ${formatted}`);

      const authHeader =
        "Basic " +
        Buffer.from(
          `${config.spectrum.projectId}:${config.spectrum.projectSecret}`
        ).toString("base64");

      const response = await fetch(
        `https://spectrum.photon.codes/projects/${config.spectrum.projectId}/users/`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "shared",
            phoneNumber: formatted,
            firstName: name,
          }),
        }
      );

      const data = (await response.json()) as any;
      console.log("[WebGateway] Photon registration response:", data);

      if (response.ok && data.succeed) {
        const assignedNumber = data.data?.assignedPhoneNumber || "+1 (646) 579-2852";
        return this.sendJson(res, {
          success: true,
          message: `Phone ${formatted} authorized! You can now text Kite directly on iMessage at: ${assignedNumber}`,
          assignedPhoneNumber: assignedNumber,
          data,
        });
      } else {
        return this.sendJson(
          res,
          {
            success: false,
            error: data?.message || "Failed to register on carrier network.",
            data,
          },
          400
        );
      }
    } catch (err: any) {
      console.error("[WebGateway] Register error:", err);
      return this.sendJson(res, { error: err.message }, 500);
    }
  }

  private readJsonBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });
  }

  private sendJson(res: http.ServerResponse, data: any, statusCode: number = 200) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }
}
