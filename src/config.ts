import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export interface AppConfig {
  spectrum: {
    projectId: string;
    projectSecret: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  groq: {
    apiKey: string;
    model: string;
    fastModel: string;
  };
  port: number;
}

const spectrumProjectId = process.env.SPECTRUM_PROJECT_ID || "";
const spectrumProjectSecret = process.env.SPECTRUM_PROJECT_SECRET || "";
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const groqApiKey = process.env.GROQ_API_KEY || "";
const port = Number(process.env.PORT) || 3001;

if (!spectrumProjectId || !spectrumProjectSecret) {
  console.warn("⚠️ Warning: SPECTRUM_PROJECT_ID or SPECTRUM_PROJECT_SECRET is not set.");
}

export const config: AppConfig = {
  spectrum: {
    projectId: spectrumProjectId,
    projectSecret: spectrumProjectSecret,
  },
  gemini: {
    apiKey: geminiApiKey,
    model: "gemini-2.5-flash",
  },
  groq: {
    apiKey: groqApiKey,
    model: "openai/gpt-oss-120b",
    fastModel: "openai/gpt-oss-20b",
  },
  port,
};
