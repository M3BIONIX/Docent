const API_BASE = `${import.meta.env.VITE_API_ORIGIN ?? ""}/api`;

export interface PlanResponse {
  instructions: string;
  topics: string[];
}

export interface EvaluateResponse {
  understandingScore: number;
  onTrack: boolean;
  realignmentNote: string | null;
  nextProbe: string | null;
  masteryReached: boolean;
  rationale: string | null;
}

/** POST /api/plan — turn ALL documents into one teaching brief + topic list. */
export async function planCorpus(docs: { title: string; text: string }[]): Promise<PlanResponse> {
  const res = await fetch(`${API_BASE}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docs }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.code ? `Plan failed: ${body.code}` : `Plan failed: ${res.status}`);
  }
  return (await res.json()) as PlanResponse;
}

/** POST /api/evaluate — single global, anti-gaming understanding score. */
export async function evaluate(input: {
  transcript: { role: "assistant" | "user"; text: string }[];
  topics: string[];
  priorScore: number | null;
}): Promise<EvaluateResponse> {
  const res = await fetch(`${API_BASE}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.code ? `Evaluate failed: ${body.code}` : `Evaluate failed: ${res.status}`);
  }
  return (await res.json()) as EvaluateResponse;
}

/**
 * POST /api/realtime/session — SDP proxy. Sends the WebRTC offer + teaching
 * instructions, returns OpenAI's answer SDP (text). Audio then flows
 * browser <-> OpenAI directly.
 */
export async function negotiateRealtime(sdp: string, instructions: string): Promise<string> {
  const res = await fetch(`${API_BASE}/realtime/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sdp, instructions }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Realtime negotiation failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return text;
}
