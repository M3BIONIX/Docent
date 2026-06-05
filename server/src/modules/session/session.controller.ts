import { Router, type Request, type Response, type NextFunction } from "express";
import { validateBody } from "../../middleware/validate.middleware.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { getAssignedDocuments, getAssignedDocumentTexts } from "../../services/documents/document.service.js";
import { buildPlan } from "../plan/plan.service.js";
import {
  startSession,
  sessionBelongsTo,
  recordTurn,
  recordScore,
  endSession,
} from "../../services/sessions/session.service.js";
import { turnSchema, scoreSchema, endSchema } from "./session.dto.js";

export const meRouter = Router();
export const sessionRouter = Router();

/** GET /api/me — profile + which documents the learner is assigned (titles only). */
meRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const documents = await getAssignedDocuments(user.id);
    res.json({ user, documents });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/session/start — build the teaching plan from the learner's ASSIGNED
 * documents (server-side; the learner never sees or picks them), create a session
 * row, and return the realtime instructions + topics.
 */
sessionRouter.post("/start", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const docs = await getAssignedDocumentTexts(user.id);
    if (docs.length === 0) {
      throw new HttpError(400, "NO_DOCUMENTS", "No documents have been assigned to you yet.");
    }
    const plan = await buildPlan({ docs });
    const sessionId = await startSession(user.id, plan.topics);
    res.json({ sessionId, instructions: plan.instructions, topics: plan.topics });
  } catch (e) {
    next(e);
  }
});

async function assertOwnSession(req: Request): Promise<string> {
  const sessionId = req.params.id!;
  const ok = await sessionBelongsTo(sessionId, req.user!.id);
  if (!ok) throw new HttpError(404, "SESSION_NOT_FOUND", "Session not found");
  return sessionId;
}

sessionRouter.post(
  "/:id/turn",
  validateBody(turnSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = await assertOwnSession(req);
      await recordTurn(sessionId, req.body.role, req.body.content);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

sessionRouter.post(
  "/:id/score",
  validateBody(scoreSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = await assertOwnSession(req);
      await recordScore(sessionId, req.body.score, req.body.onTrack);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

sessionRouter.post(
  "/:id/end",
  validateBody(endSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = await assertOwnSession(req);
      await endSession(sessionId, req.body);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);
