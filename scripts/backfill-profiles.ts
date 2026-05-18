import { Client } from "pg";

async function main() {
  const client = new Client({
    host: "aws-1-ap-southeast-2.pooler.supabase.com",
    port: 5432,
    user: "postgres.kuvznfxputxruegpinnp",
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(`
    insert into public.profiles (id, email, full_name, role)
    select u.id, u.email,
           coalesce(u.raw_user_meta_data->>'full_name', u.email),
           case when row_number() over (order by u.created_at) = 1
                then 'admin'::user_role else 'user'::user_role end
      from auth.users u
      left join public.profiles p on p.id = u.id
     where p.id is null
  `);
  const r = await client.query<{ email: string; role: string }>(
    "select email, role from public.profiles order by created_at",
  );
  console.log(`Profiles (${r.rows.length}):`);
  for (const p of r.rows) console.log(`  ${p.email} · ${p.role}`);
  const v = await client.query<{ n: number }>(
    "select count(*)::int as n from public.vehicles",
  );
  console.log(`Vehicles seeded: ${v.rows[0].n}`);
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
