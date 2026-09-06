import { Spectrum, attachment } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { terminal } from "spectrum-ts/providers/terminal";
import { config } from "./config.js";
import { MemoryStore } from "./memory.js";
import { SchedulerService, Reminder } from "./scheduler.js";
import { KiteBrain } from "./brain.js";
import { WebGateway } from "./server.js";

const isTerminalOnly = process.argv.includes("--terminal");
const isIMessageOnly = process.argv.includes("--imessage");

async function extractInboundContent(content: any): Promise<{ text: string; media?: { mimeType: string; data: Buffer } }> {
  if (!content) return { text: "" };

  if (content.type === "text") {
    return { text: content.text || "" };
  }

  if (content.type === "markdown") {
    return { text: content.markdown || "" };
  }

  if (content.type === "effect") {
    return extractInboundContent(content.content);
  }

  if (content.type === "group" && Array.isArray(content.items)) {
    let combinedText = "";
    let foundMedia: any = undefined;
    for (const item of content.items) {
      const sub = await extractInboundContent(item.content || item);
      if (sub.text) combinedText += (combinedText ? "\n" : "") + sub.text;
      if (!foundMedia && sub.media) foundMedia = sub.media;
    }
    return { text: combinedText, media: foundMedia };
  }

  if (content.type === "attachment" || content.type === "voice") {
    const target = content.attachment || content;
    const caption = target.caption || target.text || content.caption || "";
    let buffer: Buffer | null = null;

    if (typeof target.read === "function") {
      try {
        buffer = await target.read();
      } catch (e) {
        console.error("[Kite] Error calling target.read():", e);
      }
    } else if (typeof content.read === "function") {
      try {
        buffer = await content.read();
      } catch (e) {
        console.error("[Kite] Error calling content.read():", e);
      }
    } else if (target.data) {
      buffer = Buffer.isBuffer(target.data) ? target.data : Buffer.from(target.data);
    }

    const mime = target.mimeType || content.mimeType || (content.type === "voice" ? "audio/m4a" : "application/octet-stream");
    let media: any = undefined;
    if (buffer && buffer.length > 0) {
      media = { mimeType: mime, data: buffer };
      console.log(`[Kite] Successfully extracted media: ${mime} (${buffer.length} bytes)`);
    } else {
      console.warn(`[Kite] Inbound attachment had no readable bytes (type=${content.type}, mime=${mime})`);
    }

    return { text: caption, media };
  }

  return { text: content.text || content.caption || "" };
}

async function main() {
  console.log(`
  ════════════════════════════════════════════════════════
    🪁  KITE: YOUR PROACTIVE HUMAN COMPANION ON IMESSAGE
    Built with Photon Spectrum | Proactive · Memory · Voice
  ════════════════════════════════════════════════════════
  `);

  const memory = new MemoryStore();
  const scheduler = new SchedulerService();
  const brain = new KiteBrain(memory, scheduler);
  const webGateway = new WebGateway(brain, scheduler, memory);

  // Cache user space references so the scheduler can proactively dispatch reminders directly to iMessage
  const userSpaces = new Map<string, any>();

  // Wire proactive background scheduler to outbound messaging
  scheduler.setCallback(async (reminder: Reminder) => {
    console.log(`[Kite Proactive Dispatch] Triggering reminder ${reminder.id} for user ${reminder.userId}`);
    const space = userSpaces.get(reminder.userId);
    if (space) {
      try {
        const ping = reminder.isAlarm
          ? `🚨 ALARM: ${reminder.text}!\nTime to take action. Reply 'done' or 👍 once finished.`
          : `⏰ Reminder: "${reminder.text}"!\nReply 'done' when finished so I can check it off your list!`;
        
        memory.addHistory(reminder.userId, "kite", ping);
        await space.send(ping);
        console.log(`[Kite Proactive Dispatch] Successfully delivered to ${reminder.userId} via iMessage!`);
      } catch (err) {
        console.error(`[Kite Proactive Dispatch] Error sending to ${reminder.userId}:`, err);
      }
    } else {
      console.log(`[Kite Proactive Dispatch] User ${reminder.userId} is not currently cached in an active iMessage space.`);
    }
  });

  // Start Universal Web Gateway & Simulator on PORT 3001
  const port = Number(process.env.PORT) || 3001;
  await webGateway.start(port);

  // Setup Providers (Photon Spectrum)
  const providers: any[] = [];

  if (isTerminalOnly) {
    console.log("🖥️  Mode: Terminal Console Only");
    providers.push(terminal.config());
  } else if (isIMessageOnly) {
    console.log("📱 Mode: Live iMessage Only");
    providers.push(imessage.config());
  } else {
    console.log("🌐 Mode: Dual (Live iMessage + Terminal Console)");
    providers.push(terminal.config());
    providers.push(imessage.config());
  }

  process.on("unhandledRejection", (reason) => {
    console.error("⚠️ Unhandled Rejection intercepted:", reason);
  });

  process.on("uncaughtException", (err) => {
    console.error("⚠️ Uncaught Exception intercepted:", err);
  });

  let attempt = 0;
  while (true) {
    let app: any = null;
    try {
      attempt++;
      console.log(`[${new Date().toLocaleTimeString()}] 🔌 Connecting to Photon Spectrum (attempt ${attempt})...`);

      app = await Spectrum({
        projectId: config.spectrum.projectId,
        projectSecret: config.spectrum.projectSecret,
        providers,
      });

      console.log(`[${new Date().toLocaleTimeString()}] ✨ Kite is LIVE on Photon Spectrum!`);
      console.log("💡 Tip: Send 'Remind me in 5 minutes to call mom' or send a voice memo.");
      console.log(`💡 Web simulator & dashboard open at: http://localhost:${port}`);
      attempt = 0;

      for await (const [space, message] of app.messages) {
        try {
          // Ignore self messages
          if ((message as any).isSelf || (message as any).sender?.isSelf) {
            continue;
          }

          const senderId = message.sender?.id || "friend";
          // Cache the space reference for proactive reminders
          userSpaces.set(senderId, space);

          // 1. Ignore non-conversational iMessage events (read receipts, typing)
          if (message.content.type === "read") {
            continue;
          }

          if (message.content.type === "typing") {
            continue;
          }

          // 2. Handle Apple Tapback Reactions gracefully without echoing text
          if (message.content.type === "reaction") {
            const emoji = (message.content as any).emoji || "reaction";
            console.log(`[${message.platform}] Tapback reaction from ${senderId}: ${emoji}`);
            if (emoji === "❤️" || emoji === "👍" || emoji === "love" || emoji === "like") {
              const latest = scheduler.getLatestTriggered(senderId);
              if (latest) {
                scheduler.markAcknowledged(latest.id);
                memory.incrementCompletedTasks(senderId);
                console.log(`[Kite] Checked off reminder "${latest.text}" via tapback!`);
              }
            }
            continue;
          }

          const { text: userText, media } = await extractInboundContent(message.content);
          const cleanText = userText.trim();

          // 3. Ignore empty events
          if (!cleanText && !media) {
            console.log(`[${message.platform}] Ignored empty event (${message.content.type}) from ${senderId}`);
            continue;
          }

          console.log(`[${message.platform}] Message from ${senderId}: "${cleanText || (media ? `[Media: ${media.mimeType}]` : "")}"`);

          // Process through KiteBrain
          await space.responding(async () => {
            const resp = await brain.processMessage(senderId, cleanText, media);

            // Apply Apple Tapback Reaction if present
            if (resp.tapback && message.react) {
              try {
                await message.react(resp.tapback);
              } catch (reactErr) {
                // Platform might not support reactions
              }
            }

            // Send Outbound Text
            console.log(`[${new Date().toLocaleTimeString()}] 📤 Kite replied to ${senderId}: "${resp.reply}"`);
            await space.send(resp.reply);
          });
        } catch (msgErr) {
          console.error("[Kite] Error handling message:", msgErr);
          try {
            await space.send("I hit a slight speed bump, but I'm right here! Could you say that one more time?");
          } catch {}
        }
      }

      console.warn("⚠️ Spectrum stream ended. Re-establishing connection in 3 seconds...");
    } catch (connErr: any) {
      console.error(`💥 Spectrum connection error: ${connErr?.message || connErr}. Reconnecting in 5 seconds...`);
    } finally {
      if (app && typeof app.stop === "function") {
        try {
          await app.stop();
        } catch {}
      }
    }

    await new Promise((r) => setTimeout(r, 5000));
  }
}

main().catch((err) => {
  console.error("Fatal initialization error:", err);
  process.exit(1);
});
