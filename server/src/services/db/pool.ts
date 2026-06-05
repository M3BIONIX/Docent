import pg from "pg";
import { env } from "../../config/env.js";

/**
 * Single Postgres pool (Supabase direct connection). All DB access goes through
 * here — the backend is the authenticated gateway; RLS on the tables blocks any
 * direct PostgREST access. SSL is required by Supabase.
 */
let pool: pg.Pool | null = null;

export class DatabaseNotConfiguredError extends Error {
  readonly code = "DATABASE_NOT_CONFIGURED";
  constructor() {
    super("DATABASE_URL is not configured");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function getPool(): pg.Pool {
  if (!env.DATABASE_URL) throw new DatabaseNotConfiguredError();
  if (!pool) {
    pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params as never[]);
}
