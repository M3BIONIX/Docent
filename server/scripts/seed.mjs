// Seeds 1 admin + 4 learners directly into Supabase Auth (auth.users + auth.identities)
// with bcrypt passwords and confirmed emails, then creates their public.profiles.
// Needed because email confirmation is ON and no service-role key is available.
// Idempotent: skips users that already exist (by email).
// Usage: DATABASE_URL=... node scripts/seed.mjs
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "DocentAdmin#1";
const LEARNER_PASSWORD = process.env.SEED_LEARNER_PASSWORD || "DocentLearn#1";

const USERS = [
  { email: "admin@docent.app", name: "Admin", role: "admin", password: ADMIN_PASSWORD },
  { email: "alice@docent.app", name: "Alice", role: "learner", password: LEARNER_PASSWORD },
  { email: "bob@docent.app", name: "Bob", role: "learner", password: LEARNER_PASSWORD },
  { email: "carol@docent.app", name: "Carol", role: "learner", password: LEARNER_PASSWORD },
  { email: "dave@docent.app", name: "Dave", role: "learner", password: LEARNER_PASSWORD },
];

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

async function seedUser(u) {
  const existing = await client.query("select id from auth.users where email=$1", [u.email]);
  if (existing.rows[0]) {
    // ensure a profile row exists with the right role
    await client.query(
      `insert into public.profiles (id, email, name, role) values ($1,$2,$3,$4)
       on conflict (id) do update set role=excluded.role, name=excluded.name`,
      [existing.rows[0].id, u.email, u.name, u.role],
    );
    return `${u.email}: already existed (profile ensured)`;
  }

  const id = randomUUID();
  const hash = bcrypt.hashSync(u.password, 10);
  await client.query("begin");
  try {
    await client.query(
      `insert into auth.users (
         instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         confirmation_token, recovery_token, email_change_token_new, email_change,
         email_change_token_current, reauthentication_token, is_super_admin, is_sso_user, is_anonymous
       ) values (
         '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3, now(),
         '{"provider":"email","providers":["email"]}'::jsonb, $4::jsonb, now(), now(),
         '', '', '', '', '', '', false, false, false
       )`,
      [id, u.email, hash, JSON.stringify({ name: u.name })],
    );
    await client.query(
      `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values ($1::text, $1::uuid, $2::jsonb, 'email', now(), now(), now())`,
      [id, JSON.stringify({ sub: id, email: u.email, email_verified: true })],
    );
    await client.query(
      `insert into public.profiles (id, email, name, role) values ($1,$2,$3,$4)`,
      [id, u.email, u.name, u.role],
    );
    await client.query("commit");
    return `${u.email}: created (${u.role})`;
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}

try {
  for (const u of USERS) console.log(await seedUser(u));
  console.log("\nseed complete ✓");
  console.log(`Admin:    admin@docent.app / ${ADMIN_PASSWORD}`);
  console.log(`Learners: alice|bob|carol|dave @docent.app / ${LEARNER_PASSWORD}`);
} catch (e) {
  console.error("seed failed:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
