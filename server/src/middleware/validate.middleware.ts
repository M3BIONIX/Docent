import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/** Validates req.body against a zod schema and replaces it with the parsed value. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(result.error);
    }
    req.body = result.data;
    next();
  };
}
