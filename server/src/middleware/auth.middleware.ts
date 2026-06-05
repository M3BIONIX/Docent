import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { query } from "../services/db/pool.js";
import { HttpError } from "./error.middleware.js";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "learner";
  name: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// A lightweight Supabase client used only to validate user JWTs (publishable key).
let supabase: ReturnType<typeof createClient> | null = null;
function supabaseClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase is not configured");
  }
  if (!supabase) {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

/**
 * Verifies the Supabase access token (Authorization: Bearer <jwt>), then loads
 * the caller's profile + role from the DB and attaches it to req.user.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Missing bearer token");

    const { data, error } = await supabaseClient().auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, "UNAUTHENTICATED", "Invalid or expired token");

    const profile = await query<{ id: string; email: string; role: "admin" | "learner"; name: string | null }>(
      "select id, email, role, name from public.profiles where id = $1",
      [data.user.id],
    );
    if (!profile.rows[0]) throw new HttpError(403, "NO_PROFILE", "No profile for this user");

    req.user = profile.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

/** Must run after requireAuth. Rejects non-admins. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return next(new HttpError(403, "FORBIDDEN", "Admin access required"));
  }
  next();
}
