import { Router, type Request, type Response, type NextFunction } from "express";
import { validateBody } from "../../middleware/validate.middleware.js";
import { embedRequestSchema, type EmbedRequest, type EmbedResponse } from "./embed.dto.js";
import { embedTexts } from "./embed.service.js";

export const embedRouter = Router();

embedRouter.post(
  "/",
  validateBody(embedRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { texts } = req.body as EmbedRequest;
      const vectors = await embedTexts(texts);
      const payload: EmbedResponse = { vectors };
      res.json(payload);
    } catch (error) {
      next(error);
    }
  },
);
