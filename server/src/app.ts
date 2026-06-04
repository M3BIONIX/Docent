import express, { type Express } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { embedRouter } from "./modules/embed/embed.controller.js";
import { turnRouter } from "./modules/turn/turn.controller.js";
import { errorHandler } from "./middleware/error.middleware.js";

/** Builds the Express app (separated from listen() so tests can import it). */
export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), openai: Boolean(env.OPENAI_API_KEY) });
  });

  app.use("/embed", embedRouter);
  app.use("/turn", turnRouter);

  app.use(errorHandler);
  return app;
}
