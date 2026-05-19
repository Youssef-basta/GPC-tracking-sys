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
  const r = await client.query<{
    email: string;
    confirmed: boolean;
    created: string;
    last_sign_in: string | null;
    has_profile: boolean;
  }>(`
    select u.email,
           (u.email_confirmed_at is not null) as confirmed,
           u.created_at::text as created,
           u.last_sign_in_at::text as last_sign_in,
           (p.id is not null) as has_profile
      from auth.users u
      left join public.profiles p on p.id = u.id
     order by u.created_at desc
  `);
  console.log("Users in Supabase Auth:");
  for (const row of r.rows) {
    console.log(
      `  ${row.email}  | confirmed=${row.confirmed}  | profile=${row.has_profile}  | last_login=${row.last_sign_in || "never"}`,
    );
  }
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
