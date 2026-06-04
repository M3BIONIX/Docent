/**
 * Loose, defensive parsing primitives for model JSON output.
 * Ported from predint's evaluator: tolerant of fenced code blocks, loose
 * booleans ("yes"/"1"/"on"), and null-ish text ("none"/"n/a").
 * Shared by /api/plan and /api/evaluate.
 */

export function normalizeLooseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "yes", "y", "1", "on"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "off"].includes(normalized)) return false;
  return fallback;
}

export function normalizeLooseText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === "null" || lower === "none" || lower === "n/a") return null;
  return normalized.slice(0, maxLength);
}

export function normalizeScore(value: unknown): number | null {
  let n: number | null = null;
  if (typeof value === "number" && Number.isFinite(value)) n = value;
  else if (typeof value === "string" && value.trim() && value.trim().toLowerCase() !== "null") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) n = parsed;
  }
  if (n === null) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function extractJsonObjectString(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}
