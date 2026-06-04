import { Router, type Request, type Response, type NextFunction } from "express";
import { validateBody } from "../../middleware/validate.middleware.js";
import { planRequestSchema, type PlanRequest } from "./plan.dto.js";
import { buildPlan } from "./plan.service.js";

export const planRouter = Router();

planRouter.post(
  "/",
  validateBody(planRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await buildPlan(req.body as PlanRequest);
      res.json(plan);
    } catch (error) {
      next(error);
    }
  },
);
