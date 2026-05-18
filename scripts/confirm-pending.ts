/**
 * One-shot fix: mark every unconfirmed user as email-confirmed.
 * Useful while "Confirm email" is still on in Supabase Auth settings.
 *
 * Run: npx tsx scripts/confirm-pending.ts
 */
import { createClient } from "@supabase/supabase-js";
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  let confirmed = 0;
  let already = 0;
  let page = 1;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("listUsers failed:", error.message);
      process.exit(1);
    }
    if (data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email_confirmed_at) {
        already++;
        continue;
      }
      const { error: upErr } = await sb.auth.admin.updateUserById(u.id, {
        email_confirm: true,
      });
      if (upErr) {
        console.error(`  fail: ${u.email} → ${upErr.message}`);
      } else {
        console.log(`  confirmed: ${u.email}`);
        confirmed++;
      }
    }
    if (data.users.length < 200) break;
    page++;
  }
  console.log(`Done. ${confirmed} newly confirmed, ${already} already confirmed.`);
}

main();
