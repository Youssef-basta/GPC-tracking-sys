/**
 * Local simulator — hits the running /api/simulate endpoint on a loop.
 * Useful for development; in prod, schedule POST /api/simulate via Vercel cron
 * or a Supabase scheduled function using SIMULATE_CRON_SECRET.
 *
 * Run: npm run simulate
 */
import { readFileSync } from "node:fs";
import path from "node:path";

function loadDotEnv() {
  try {
    const raw = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {}
}
loadDotEnv();

const url = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000") + "/api/simulate";
const secret = process.env.SIMULATE_CRON_SECRET;
if (!secret) {
  console.error("SIMULATE_CRON_SECRET missing from .env.local");
  process.exit(1);
}

const intervalMs = Number(process.argv[2]) || 5000;

async function tick() {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = (await res.json().catch(() => ({}))) as {
      pings?: number;
      anomalies?: number;
    };
    if (!res.ok) {
      console.error("simulate error:", res.status, json);
      return;
    }
    console.log(
      new Date().toISOString(),
      "pings:",
      json.pings ?? 0,
      "anomalies:",
      json.anomalies ?? 0,
    );
  } catch (e) {
    console.error("simulate fetch failed:", (e as Error).message);
  }
}

console.log(`Simulating every ${intervalMs}ms → ${url}`);
tick();
setInterval(tick, intervalMs);
