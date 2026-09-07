import { spawn } from "child_process";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

let childProcess = null;
let consecutiveFailures = 0;
const MAX_FAILURES = 3;
const CHECK_INTERVAL_MS = 30000; // 30 seconds
const PORT = process.env.PORT || 3001;
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/status`;

console.log(`
🛡️  KITE WATCHDOG SUPERVISOR ACTIVE
• Monitors Kite process health every 30s
• Auto-restarts on crash, network drop, or zombie connection
────────────────────────────────────────────────────────
`);

function startProcess() {
  console.log(`[${new Date().toLocaleTimeString()}] 🚀 Launching Kite child process...`);
  
  childProcess = spawn("node", ["dist/index.js", "--imessage"], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    shell: true,
  });

  childProcess.on("exit", (code, signal) => {
    console.warn(`[${new Date().toLocaleTimeString()}] ⚠️ Kite process exited (code: ${code}, signal: ${signal}).`);
    childProcess = null;
    console.log("Restarting in 3 seconds...");
    setTimeout(startProcess, 3000);
  });

  childProcess.on("error", (err) => {
    console.error(`[${new Date().toLocaleTimeString()}] 💥 Process spawn error:`, err);
  });
}

function checkHealth() {
  if (!childProcess) return;

  const req = http.get(HEALTH_URL, { timeout: 10000 }, (res) => {
    if (res.statusCode === 200) {
      consecutiveFailures = 0; // healthy
    } else {
      handleHealthFailure(`Received HTTP ${res.statusCode}`);
    }
  });

  req.on("timeout", () => {
    req.destroy();
    handleHealthFailure("Health check timed out (5s)");
  });

  req.on("error", (err) => {
    handleHealthFailure(`Health check failed (${err.message})`);
  });
}

function handleHealthFailure(reason) {
  consecutiveFailures++;
  console.warn(`[${new Date().toLocaleTimeString()}] ⚠️ Warning: Kite unresponsive (${reason}). Strike ${consecutiveFailures}/${MAX_FAILURES}`);

  if (consecutiveFailures >= MAX_FAILURES) {
    console.error(`[${new Date().toLocaleTimeString()}] 🚨 Kite reached ${MAX_FAILURES} failed health checks! Force-killing zombie process...`);
    consecutiveFailures = 0;
    if (childProcess) {
      try {
        childProcess.kill("SIGKILL");
      } catch {}
    }
  }
}

// Start process & periodic monitor
startProcess();
setInterval(checkHealth, CHECK_INTERVAL_MS);
