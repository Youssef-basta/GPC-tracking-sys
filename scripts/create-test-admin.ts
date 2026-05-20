/**
 * Create a test admin user via Supabase Admin API.
 *
 * Usage:
 *   npx tsx scripts/create-test-admin.ts <email> <password>
 *
 * Defaults: test@gpc.local / TestUser2026!
 *
 * The user is created with email_confirm=true so they can log in immediately,
 * then their profile.role is set to 'admin'.
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

const email = process.argv[2] || "test@gpc.local";
const password = process.argv[3] || "TestUser2026!";
const fullName = process.argv[4] || "Test Admin";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Try to find an existing user with this email
  const { data: list, error: listErr } = await sb.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listErr) {
    console.error("listUsers failed:", listErr.message);
    process.exit(1);
  }
  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  let userId: string;
  if (existing) {
    console.log(`User already exists (${existing.id}). Resetting password…`);
    const { error } = await sb.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      console.error("update failed:", error.message);
      process.exit(1);
    }
    userId = existing.id;
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      console.error("createUser failed:", error?.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`Created user ${userId}`);
  }

  // The handle_new_user trigger should have created a profile row, but if the
  // user was created some other way, ensure the row exists with admin role.
  const { error: upsertErr } = await sb.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      role: "admin",
      disabled: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (upsertErr) {
    console.error("profile upsert failed:", upsertErr.message);
    process.exit(1);
  }

  console.log("");
  console.log("✓ Test admin ready.");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role:     admin`);
  console.log("");
  console.log("Log in at https://gpc-tracking-sys.vercel.app/login");
}

main();
