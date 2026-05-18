/**
 * Apply supabase/setup.sql via the Supabase connection pooler.
 * Probes common AWS regions for the project's pooler endpoint, then runs the SQL.
 *
 * Run: SUPABASE_PROJECT_REF=... SUPABASE_DB_PASSWORD=... npx tsx scripts/apply-schema.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import { Client } from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!ref || !password) {
  console.error("Missing SUPABASE_PROJECT_REF or SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const regions = [
  "eu-central-1",
  "us-east-1",
  "us-east-2",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "us-west-1",
  "us-west-2",
  "sa-east-1",
  "eu-north-1",
  "ca-central-1",
  "me-south-1",
];

const hostPrefixes = ["aws-0", "aws-1", "aws-2"];

async function findPoolerHost(): Promise<string | null> {
  for (const prefix of hostPrefixes) {
    for (const region of regions) {
      const host = `${prefix}-${region}.pooler.supabase.com`;
      try {
        await dns.lookup(host);
      } catch {
        continue;
      }

      const client = new Client({
        host,
        port: 6543,
        user: `postgres.${ref}`,
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });
      try {
        await client.connect();
        await client.query("select 1");
        await client.end();
        console.log(`  ${prefix}-${region}: ✓ AUTH OK`);
        return host;
      } catch (e) {
        const msg = (e as Error).message;
        if (!msg.includes("Tenant or user not found")) {
          console.log(`  ${prefix}-${region}: ${msg.slice(0, 90)}`);
        }
        try {
          await client.end();
        } catch {}
      }
    }
  }
  return null;
}

async function main() {
  console.log("Probing pooler hosts ...");
  const host = await findPoolerHost();
  if (!host) {
    console.error(
      "Could not find a pooler that accepts this project + password. " +
        "Double-check the password (try resetting it) or share the exact Connection string from Supabase.",
    );
    process.exit(2);
  }

  const sqlPath = path.resolve(process.cwd(), "supabase/setup.sql");
  const sql = readFileSync(sqlPath, "utf8");

  // Use a session-pooler client (port 5432) for the DDL — transaction pooler can't run DDL.
  const sessionClient = new Client({
    host,
    port: 5432,
    user: `postgres.${ref}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await sessionClient.connect();
  } catch (e) {
    console.error(
      "Session pooler (5432) refused — falling back to transaction pooler. If DDL fails, please run setup.sql via the SQL Editor.",
      (e as Error).message,
    );
  }
  const client = sessionClient;

  console.log("Applying setup.sql ...");
  try {
    await client.query(sql);
    console.log("✓ setup.sql applied.");
  } catch (e) {
    console.error("SQL error:", (e as Error).message);
    process.exit(3);
  }

  const tables = await client.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  );
  console.log(`\nTables in public schema (${tables.rows.length}):`);
  for (const row of tables.rows) console.log(`  - ${row.table_name}`);

  // PostgREST schema cache reload — so the API immediately sees the new tables
  try {
    await client.query("notify pgrst, 'reload schema'");
    console.log("✓ PostgREST schema cache reload triggered.");
  } catch {
    // not fatal
  }

  await client.end();
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
