/**
 * Seed script — inserts demo vehicles into the locally-configured Supabase project.
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 *
 * Run: npm run seed
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
  } catch {
    // ignore
  }
}
loadDotEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const sb = createClient(url, key);

const vehicles = [
  { plate: "GPC-1001", label: "Truck A", model: "Hino 300", status: "active",  last_lat: 24.7136, last_lng: 46.6753, description: "Distribution truck — north Riyadh route" },
  { plate: "GPC-1002", label: "Van B",   model: "Toyota HiAce", status: "active",  last_lat: 24.7240, last_lng: 46.6810, description: "City courier" },
  { plate: "GPC-1003", label: "Truck C", model: "Isuzu D-Max",  status: "idle",    last_lat: 24.7000, last_lng: 46.6500, description: "Construction support" },
  { plate: "GPC-1004", label: "Sedan D", model: "Toyota Camry", status: "offline", last_lat: 24.6905, last_lng: 46.6712, description: "Manager pool car" },
  { plate: "GPC-1005", label: "Truck E", model: "Mercedes Actros", status: "active", last_lat: 24.7320, last_lng: 46.7000, description: "Heavy haul" },
];

async function main() {
  const { error, data } = await sb
    .from("vehicles")
    .upsert(
      vehicles.map((v) => ({ ...v, last_seen_at: new Date().toISOString() })),
      { onConflict: "plate" },
    )
    .select("id, plate");
  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
  console.log(`Seeded ${data?.length ?? 0} vehicles.`);
}

main();
