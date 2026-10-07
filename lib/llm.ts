// One JSON-in/JSON-out call. OpenAI first; Gemini (rate-limited per model) as fallback.
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

// Free-tier limits per model (AI Studio → Rate limit, project "yolomarkets", 2026-10-07). Each model has its own quota.
const LIMITS: Record<string, { rpm: number; rpd: number }> = {
  "gemini-3.8-flash": { rpm: 5, rpd: 20 },
  "gemini-3.7-flash": { rpm: 5, rpd: 20 },
  "gemini-3.6-flash": { rpm: 5, rpd: 20 },
  "gemini-3.5-flash": { rpm: 5, rpd: 20 },
  "gemini-3.5-flash-lite": { rpm: 15, rpd: 500 },
  "gemini-3.1-flash-lite": { rpm: 15, rpd: 500 },
};
// "quality" = tailoring (few calls, needs the best model); "fast" = scoring/outreach (more calls, Flash-Lite is plenty).
const CHAINS = {
  quality: ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
  fast: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"],
};
export type Tier = keyof typeof CHAINS;

// ---- rate limiter: RPM in memory (sliding 60s window), RPD persisted so restarts don't forget today's usage ----
const USAGE_FILE = path.join(process.cwd(), ".data", "gemini_usage.json");
const recent: Record<string, number[]> = {};
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); // quotas reset at midnight Pacific
type Usage = { date: string; count: Record<string, number>; exhausted: Record<string, boolean> };
function readUsage(): Usage {
  try {
    const u = JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
    if (u.date === today()) return u;
  } catch {}
  return { date: today(), count: {}, exhausted: {} };
}
function writeUsage(u: Usage) {
  fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
  fs.writeFileSync(USAGE_FILE, JSON.stringify(u));
}
export function geminiUsage() {
  const u = readUsage();
  return Object.entries(LIMITS).map(([m, l]) => ({ model: m, used: u.count[m] || 0, rpd: l.rpd, exhausted: Boolean(u.exhausted[m]) }));
}

// ms to wait before this model may be called (0 = now), or -1 if it's out for today.
function slotFor(model: string) {
  const l = LIMITS[model];
  const u = readUsage();
  if (u.exhausted[model] || (u.count[model] || 0) >= l.rpd) return -1;
  const now = Date.now();
  const win = (recent[model] = (recent[model] || []).filter((t) => now - t < 60_000));
  return win.length < l.rpm ? 0 : 60_000 - (now - win[0]) + 250;
}
function record(model: string) {
  (recent[model] ||= []).push(Date.now());
  const u = readUsage();
  u.count[model] = (u.count[model] || 0) + 1;
  writeUsage(u);
}
function markExhausted(model: string) {
  const u = readUsage();
  u.exhausted[model] = true;
  writeUsage(u);
}

let oa: OpenAI | null = null;
let gg: GoogleGenAI | null = null;
let openaiPausedUntil = 0;

export async function llmJson<T = any>(system: string, user: string, tier: Tier = "fast"): Promise<{ data: T; model: string }> {
  const errors: string[] = [];
  // While OpenAI says "no credits"/quota (card issues), skip it for 10 min instead of paying a failed call every time.
  if (OPENAI_KEY && Date.now() > openaiPausedUntil) {
    try {
      oa ??= new OpenAI({ apiKey: OPENAI_KEY });
      const r = await oa.chat.completions.create({
        model: OPENAI_MODEL,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      } as any);
      return { data: JSON.parse(r.choices[0].message.content || "{}"), model: OPENAI_MODEL };
    } catch (e: any) {
      errors.push(`openai: ${String(e.message).slice(0, 160)}`);
      if (/429|quota|credits|billing|401/i.test(e.message)) openaiPausedUntil = Date.now() + 10 * 60_000;
    }
  }
  if (GEMINI_KEY) {
    gg ??= new GoogleGenAI({ apiKey: GEMINI_KEY });
    for (const model of CHAINS[tier]) {
      const wait = slotFor(model);
      if (wait < 0) { errors.push(`${model}: daily quota used`); continue; }
      if (wait > 20_000) { errors.push(`${model}: per-minute limit, skipped`); continue; }
      if (wait > 0) await new Promise((res) => setTimeout(res, wait));
      record(model);
      try {
        const r = await gg.models.generateContent({
          model,
          contents: user,
          config: { systemInstruction: system, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "low" as any } },
        });
        return { data: JSON.parse(r.text || "{}"), model };
      } catch (e: any) {
        const msg = String(e.message);
        errors.push(`${model}: ${msg.slice(0, 160)}`);
        // Daily quota hit → skip this model for the rest of the day. Busy (503) or per-minute (429) → just try the next model.
        if (/RESOURCE_EXHAUSTED|429/.test(msg) && /per.?day|PerDay|daily/i.test(msg)) markExhausted(model);
      }
    }
  }
  throw new Error("No LLM available. " + errors.join(" | "));
}
