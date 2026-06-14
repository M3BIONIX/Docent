import { getAccessToken } from "./supabase";

const API_BASE = `${import.meta.env.VITE_API_ORIGIN ?? ""}/api`;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(await authHeaders()), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.code || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

// ---- shared types ----
export interface Profile {
  id: string;
  email: string;
  role: "admin" | "learner";
  name: string | null;
}
export interface DocMeta {
  id: string;
  title: string;
  created_at: string;
  chunk_count?: number;
}
export interface Me {
  user: Profile;
  documents: DocMeta[];
}

// ---- learner ----
export const getMe = () => api<Me>("/me");

export interface StartSessionResponse {
  sessionId: string;
  instructions: string;
  topics: string[];
}
export const startSession = () => api<StartSessionResponse>("/session/start", { method: "POST" });

export const postTurn = (sessionId: string, role: "assistant" | "user", content: string) =>
  api(`/session/${sessionId}/turn`, { method: "POST", body: JSON.stringify({ role, content }) });

export const postScore = (sessionId: string, score: number, onTrack: boolean) =>
  api(`/session/${sessionId}/score`, { method: "POST", body: JSON.stringify({ score, onTrack }) });

export const endSessionApi = (
  sessionId: string,
  data: { finalScore: number; mastery: boolean; rationale: string | null },
) => api(`/session/${sessionId}/end`, { method: "POST", body: JSON.stringify(data) });

export interface EvaluateResponse {
  understandingScore: number;
  onTrack: boolean;
  realignmentNote: string | null;
  nextProbe: string | null;
  masteryReached: boolean;
  revealedMisunderstanding: boolean;
  rationale: string | null;
}
export const evaluate = (input: {
  transcript: { role: "assistant" | "user"; text: string }[];
  topics: string[];
  priorScore: number | null;
}) => api<EvaluateResponse>("/evaluate", { method: "POST", body: JSON.stringify(input) });

/** SDP proxy for realtime voice (returns answer SDP text). */
export async function negotiateRealtime(sdp: string, instructions: string): Promise<string> {
  const res = await fetch(`${API_BASE}/realtime/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ sdp, instructions }),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 300);
    try {
      message = JSON.parse(text)?.message ?? message;
    } catch {
      /* not JSON */
    }
    throw new Error(message || `Realtime negotiation failed (${res.status})`);
  }
  return text;
}

// ---- admin ----
export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "learner";
  doc_count: number;
  session_count: number;
}
export const adminListUsers = () => api<{ users: AdminUser[] }>("/admin/users").then((r) => r.users);
export const adminCreateLearner = (input: { email: string; name: string; password: string }) =>
  api<{ user: AdminUser }>("/admin/users", { method: "POST", body: JSON.stringify(input) }).then((r) => r.user);

export const adminListDocuments = () =>
  api<{ documents: DocMeta[] }>("/admin/documents").then((r) => r.documents);
export const adminCreateDocument = (title: string, text: string) =>
  api<{ document: DocMeta }>("/admin/documents", {
    method: "POST",
    body: JSON.stringify({ title, text }),
  }).then((r) => r.document);
export const adminDeleteDocument = (id: string) => api(`/admin/documents/${id}`, { method: "DELETE" });

export const adminGetAssignments = (userId: string) =>
  api<{ documentIds: string[] }>(`/admin/users/${userId}/assignments`).then((r) => r.documentIds);
export const adminSetAssignments = (userId: string, documentIds: string[]) =>
  api(`/admin/users/${userId}/assignments`, { method: "PUT", body: JSON.stringify({ documentIds }) });

export interface SessionSummary {
  id: string;
  started_at: string;
  ended_at: string | null;
  final_score: number | null;
  mastery: boolean;
  rationale: string | null;
  topics: string[];
  turn_count: number;
}
export const adminGetUserSessions = (userId: string) =>
  api<{ sessions: SessionSummary[] }>(`/admin/users/${userId}/sessions`).then((r) => r.sessions);

export interface SessionDetail {
  scoreSeries: { ts: string; score: number }[];
  turns: { ts: string; role: string; content: string }[];
  session: SessionSummary | null;
}
export const adminGetSessionDetail = (sessionId: string) =>
  api<SessionDetail>(`/admin/sessions/${sessionId}`);
