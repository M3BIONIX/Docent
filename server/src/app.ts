import express, { type Express, Router } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { evaluateRouter } from "./modules/evaluate/evaluate.controller.js";
import { realtimeRouter } from "./modules/realtime/realtime.controller.js";
import { adminRouter } from "./modules/admin/admin.controller.js";
import { meRouter, sessionRouter } from "./modules/session/session.controller.js";
import { requireAuth, requireAdmin } from "./middleware/auth.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";

/**
 * Builds the Express app (separated from listen() so tests and the Vercel
 * serverless entry can import it).
 *
 * All routes live under /api so the SAME app works two ways:
 *   - standalone local server (tsx)        -> http://localhost:4000/api/*
 *   - Vercel serverless function           -> /api/* (via api/[...path].ts)
 * Putting everything under /api keeps it disjoint from the static SPA routes
 * on Vercel (which owns everything that is NOT /api/*).
 */
export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "2mb" }));

  const api = Router();

  api.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      openai: Boolean(env.OPENAI_API_KEY),
      db: Boolean(env.DATABASE_URL),
    });
  });

  // Learner (any authenticated user)
  api.use("/me", requireAuth, meRouter);
  api.use("/session", requireAuth, sessionRouter);
  api.use("/evaluate", requireAuth, evaluateRouter);
  api.use("/realtime", requireAuth, realtimeRouter);

  // Admin only
  api.use("/admin", requireAuth, requireAdmin, adminRouter);

  app.use("/api", api);

  app.use(errorHandler);
  return app;
}
