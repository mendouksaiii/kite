# 🪁 Kite: Your Proactive Human Companion on iMessage

> Built with **Photon Spectrum (`spectrum-ts`)** for the Hackathon **"Most Useful Agent"** Track ($1,000 prize).

Kite is a next-generation AI companion living right inside Apple iMessage. Unlike ordinary conversational chatbots that only respond when spoken to, **Kite is proactive, attentive, and human-grounded**:

- ⏰ **Proactive Timekeeper & Alarms**: Remembers what you need to do, counts down in the background, and proactively texts you right when tasks or alarms are due.
- 🧠 **Long-Term Life Lore Memory**: Remembers your work, coffee order, friends, habits, and ongoing projects across conversations.
- 🎙️ **Voice Memo Triage**: Feed Kite unstructured voice rambles or audio brain dumps—it transcribes, extracts actionable to-dos, and sets smart reminders.
- 🧾 **Instant Micro-Utilities**: Zero-friction calculations like dinner bill/tip splitting, text tone polishing, and habit tracking.
- 📱 **Native Apple Experience**: Built with Photon Spectrum to support Apple Tapback reactions, message effects, and direct iMessage delivery.

---

## Architecture & Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | **Photon Spectrum (`spectrum-ts`)** | Apple iMessage connectivity, message routing, tapback reactions |
| **Multimodal Brain** | **Google Gemini 2.5 Flash** | Deep reasoning, audio voice memo transcription, vision document analysis |
| **High-Speed Inference** | **Groq (Llama 3.3 70B / OSS)** | Ultra-fast sub-200ms fallback & chat acceleration |
| **Scheduler Service** | **Persistent JSON Queue (`reminders.json`)** | 5-second tick loop with proactive outbound iMessage dispatch |
| **Life Lore Memory** | **Persistent Store (`memory.json`)** | Dynamic profile, habits, facts, and completed tasks counter |
| **Web Gateway & UI** | **Node.js HTTP + Bento Grid UI** | Live interactive iMessage simulator and life lore dashboard |

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
```env
SPECTRUM_PROJECT_ID=your_photon_project_id
SPECTRUM_PROJECT_SECRET=your_photon_project_secret
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
PORT=3001
```

### 3. Run the Automated Test Suite
```bash
npm run test:brain
```

### 4. Start Kite (iMessage + Web Simulator)
```bash
npm run dev
```
Open **http://localhost:3001** to view the interactive Apple iMessage simulator and Life Lore dashboard!

### 5. Register an iPhone for Live iMessage Testing
```bash
npm run add-friend +14155552671 "Alice"
```
Or type the phone number directly into the "Register" card on the web dashboard at `http://localhost:3001`.

---

## 🌟 Hackathon Judging Highlights ("Most Useful" Track)

1. **Proactive Outbound Delivery**: Most bots are completely passive. Kite uses background timers and cached Photon `space` references to text you unprompted when something matters.
2. **Apple Tapback Native**: Kite reacts with hearts (❤️), thumbs up (👍), and emphasizes (‼️) to your messages natively in iMessage.
3. **Voice Memo Brain**: In Apple Messages, users frequently send quick audio notes. Kite accepts audio attachments directly, triages them, and returns structured action items.
4. **Resilient 24/7 Supervisor**: Built with an automated reconnect supervisor loop and watchdog script to guarantee continuous uptime.
