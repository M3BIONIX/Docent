import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { getPool, query } from "../db/pool.js";

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "learner";
  doc_count: number;
  session_count: number;
}

export async function listUsers(): Promise<UserRow[]> {
  const r = await query<UserRow>(
    `select p.id, p.email, p.name, p.role,
       count(distinct ud.document_id)::int as doc_count,
       count(distinct s.id)::int as session_count
     from public.profiles p
     left join public.user_documents ud on ud.user_id = p.id
     left join public.sessions s on s.user_id = p.id
     group by p.id order by (p.role='admin') desc, p.name`,
  );
  return r.rows;
}

/** Creates a learner directly in Supabase Auth (bcrypt, confirmed) + profile. */
export async function createLearner(input: {
  email: string;
  name: string;
  password: string;
}): Promise<{ id: string; email: string; name: string; role: "learner" }> {
  const id = randomUUID();
  const hash = bcrypt.hashSync(input.password, 10);
  const pool = getPool();
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
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
      [id, input.email, hash, JSON.stringify({ name: input.name })],
    );
    await c.query(
      `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values ($1::text, $1::uuid, $2::jsonb, 'email', now(), now(), now())`,
      [id, JSON.stringify({ sub: id, email: input.email, email_verified: true })],
    );
    await c.query(
      "insert into public.profiles (id, email, name, role) values ($1,$2,$3,'learner')",
      [id, input.email, input.name],
    );
    await c.query("commit");
    return { id, email: input.email, name: input.name, role: "learner" };
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

export async function getAssignments(userId: string): Promise<string[]> {
  const r = await query<{ document_id: string }>(
    "select document_id from public.user_documents where user_id = $1",
    [userId],
  );
  return r.rows.map((row) => row.document_id);
}

/** Replace a learner's full assignment set. */
export async function setAssignments(userId: string, documentIds: string[]): Promise<void> {
  const pool = getPool();
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("delete from public.user_documents where user_id = $1", [userId]);
    for (const docId of documentIds) {
      await c.query(
        "insert into public.user_documents (user_id, document_id) values ($1,$2) on conflict do nothing",
        [userId, docId],
      );
    }
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
