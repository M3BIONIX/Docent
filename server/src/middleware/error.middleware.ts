import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { OpenAiNotConfiguredError } from "../services/openai/openai.factory.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ code: "VALIDATION_ERROR", errors: err.flatten() });
  }
  if (err instanceof OpenAiNotConfiguredError) {
    return res.status(503).json({ code: err.code, message: err.message });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ code: err.code, message: err.message });
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("[error]", message);
  return res.status(500).json({ code: "INTERNAL_ERROR", message: "Internal server error" });
}
