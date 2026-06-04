import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate.middleware.js";
import { turnRequestSchema, TURN_EVENT, type TurnRequest } from "./turn.dto.js";
import { runTurn } from "./turn.service.js";
import { OpenAiNotConfiguredError } from "../../services/openai/openai.factory.js";

export const turnRouter = Router();

function sse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

turnRouter.post("/", validateBody(turnRequestSchema), async (req: Request, res: Response) => {
  // SSE handshake
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  try {
    const { evaluation, advanceToNextDoc, stream } = await runTurn(req.body as TurnRequest);

    sse(res, TURN_EVENT.VERDICT, evaluation);

    for await (const delta of stream.textStream) {
      sse(res, TURN_EVENT.TOKEN, { delta });
    }

    sse(res, TURN_EVENT.DONE, { advanceToNextDoc });
  } catch (error) {
    const code =
      error instanceof OpenAiNotConfiguredError ? error.code : "TURN_FAILED";
    const message = error instanceof Error ? error.message : "Turn failed";
    sse(res, TURN_EVENT.ERROR, { code, message });
  } finally {
    res.end();
  }
});
