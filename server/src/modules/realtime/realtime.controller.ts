import { Router, type Request, type Response, type NextFunction } from "express";
import { validateBody } from "../../middleware/validate.middleware.js";
import { env } from "../../config/env.js";
import { OpenAiNotConfiguredError } from "../../services/openai/openai.factory.js";
import { buildRealtimeSessionConfig } from "../../services/realtime/realtime-config.js";
import { realtimeSessionRequestSchema, type RealtimeSessionRequest } from "./realtime.dto.js";

export const realtimeRouter = Router();

/** Diagnostic: confirms the configured realtime model exists for this key. */
realtimeRouter.get("/diag", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!env.OPENAI_API_KEY) throw new OpenAiNotConfiguredError();
    const r = await fetch(`https://api.openai.com/v1/models/${env.REALTIME_MODEL}`, {
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    });
    res.json({ model: env.REALTIME_MODEL, exists: r.ok, status: r.status });
  } catch (error) {
    next(error);
  }
});

/**
 * SDP proxy for OpenAI Realtime (voice). The browser does the WebRTC handshake;
 * this endpoint forwards the offer to OpenAI with the teaching session config and
 * returns the answer SDP. The audio itself flows browser <-> OpenAI directly, so
 * nothing long-lived runs on the server (Vercel-friendly).
 *
 *   browser offer SDP ──► /api/realtime/session ──► OpenAI /v1/realtime/calls
 *                                                         │
 *   browser ◄── answer SDP ◄───────────────────────────┘
 */
realtimeRouter.post(
  "/session",
  validateBody(realtimeSessionRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!env.OPENAI_API_KEY) {
        throw new OpenAiNotConfiguredError();
      }

      const { sdp, instructions } = req.body as RealtimeSessionRequest;

      const formData = new FormData();
      formData.set("sdp", sdp);
      formData.set("session", JSON.stringify(buildRealtimeSessionConfig(instructions)));

      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: formData,
      });

      const answerSdp = await response.text();
      if (!response.ok) {
        // Surface OpenAI's actual error (e.g. invalid model, invalid voice) so
        // the browser can show something actionable instead of a generic break.
        let message = answerSdp;
        try {
          message = JSON.parse(answerSdp)?.error?.message ?? answerSdp;
        } catch {
          /* not JSON; keep raw */
        }
        console.error("[realtime] negotiation failed", { status: response.status, message });
        return res
          .status(response.status === 401 ? 502 : response.status)
          .json({ code: "REALTIME_NEGOTIATION_FAILED", message });
      }

      res.type("application/sdp").send(answerSdp);
    } catch (error) {
      next(error);
    }
  },
);
