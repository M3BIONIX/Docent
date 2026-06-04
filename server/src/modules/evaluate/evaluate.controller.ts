import { Router, type Request, type Response, type NextFunction } from "express";
import { validateBody } from "../../middleware/validate.middleware.js";
import { evaluateRequestSchema, type EvaluateRequest } from "./evaluate.dto.js";
import { evaluateUnderstanding } from "./evaluate.service.js";

export const evaluateRouter = Router();

evaluateRouter.post(
  "/",
  validateBody(evaluateRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await evaluateUnderstanding(req.body as EvaluateRequest);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);
