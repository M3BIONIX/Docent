import { Router, type Request, type Response, type NextFunction } from "express";
import { validateBody } from "../../middleware/validate.middleware.js";
import { listUsers, createLearner, getAssignments, setAssignments } from "../../services/users/user.service.js";
import { listDocuments, createDocument, deleteDocument } from "../../services/documents/document.service.js";
import { listUserSessions, getSessionDetail } from "../../services/sessions/session.service.js";
import { createLearnerSchema, createDocumentSchema, assignmentsSchema } from "./admin.dto.js";

export const adminRouter = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// --- users ---
adminRouter.get("/users", wrap(async (_req, res) => {
  res.json({ users: await listUsers() });
}));

adminRouter.post("/users", validateBody(createLearnerSchema), wrap(async (req, res) => {
  res.status(201).json({ user: await createLearner(req.body) });
}));

// --- documents ---
adminRouter.get("/documents", wrap(async (_req, res) => {
  res.json({ documents: await listDocuments() });
}));

adminRouter.post("/documents", validateBody(createDocumentSchema), wrap(async (req, res) => {
  const doc = await createDocument({
    title: req.body.title,
    text: req.body.text,
    createdBy: req.user!.id,
  });
  res.status(201).json({ document: doc });
}));

adminRouter.delete("/documents/:id", wrap(async (req, res) => {
  await deleteDocument(req.params.id!);
  res.json({ ok: true });
}));

// --- assignments ---
adminRouter.get("/users/:id/assignments", wrap(async (req, res) => {
  res.json({ documentIds: await getAssignments(req.params.id!) });
}));

adminRouter.put("/users/:id/assignments", validateBody(assignmentsSchema), wrap(async (req, res) => {
  await setAssignments(req.params.id!, req.body.documentIds);
  res.json({ ok: true });
}));

// --- analytics ---
adminRouter.get("/users/:id/sessions", wrap(async (req, res) => {
  res.json({ sessions: await listUserSessions(req.params.id!) });
}));

adminRouter.get("/sessions/:id", wrap(async (req, res) => {
  res.json(await getSessionDetail(req.params.id!));
}));
