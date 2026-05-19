import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

function loadDotEnv() {
  const raw = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
loadDotEnv();

const targetEmail = process.argv[2];
const newPassword = process.argv[3];
if (!targetEmail || !newPassword) {
  console.error("Usage: reset-password.ts <email> <new-password>");
  process.exit(1);
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: list, error: e1 } = await sb.auth.admin.listUsers({ perPage: 200 });
  if (e1) { console.error(e1.message); process.exit(1); }
  const target = list.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());
  if (!target) { console.error(`No user with email ${targetEmail}`); process.exit(1); }
  const { error: e2 } = await sb.auth.admin.updateUserById(target.id, {
    password: newPassword,
  });
  if (e2) { console.error(e2.message); process.exit(1); }
  console.log(`Password reset for ${target.email}`);
}

main();
