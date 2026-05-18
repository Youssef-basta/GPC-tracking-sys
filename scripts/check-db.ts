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

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: v, error: ve } = await sb
    .from("vehicles")
    .select("plate,label,status,last_lat,last_lng");
  const { data: p, error: pe } = await sb
    .from("profiles")
    .select("email,role,disabled");

  console.log("vehicles:", ve ? "ERR " + ve.message : (v?.length ?? 0) + " rows");
  v?.forEach((r) =>
    console.log("  ", r.plate, r.label, r.status, r.last_lat, r.last_lng),
  );
  console.log("profiles:", pe ? "ERR " + pe.message : (p?.length ?? 0) + " rows");
  p?.forEach((r) =>
    console.log("  ", r.email, r.role, r.disabled ? "DISABLED" : ""),
  );
}

main();
