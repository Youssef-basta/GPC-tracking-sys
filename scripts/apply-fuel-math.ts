import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function main() {
  const sql = readFileSync(
    path.resolve(process.cwd(), "supabase/migrations/011_fuel_math.sql"),
    "utf8",
  );
  const client = new Client({
    host: "aws-1-ap-southeast-2.pooler.supabase.com",
    port: 5432,
    user: "postgres.kuvznfxputxruegpinnp",
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Applying 011_fuel_math.sql ...");
  await client.query(sql);
  console.log("✓ applied.");
  await client.query("notify pgrst, 'reload schema'");
  await client.end();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
