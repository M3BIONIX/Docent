import { query } from "../db/pool.js";

export async function startSession(userId: string, topics: string[]): Promise<string> {
  const r = await query<{ id: string }>(
    "insert into public.sessions (user_id, topics) values ($1, $2::jsonb) returning id",
    [userId, JSON.stringify(topics)],
  );
  return r.rows[0]!.id;
}

/** Ensures a session belongs to the caller (learners can only touch their own). */
export async function sessionBelongsTo(sessionId: string, userId: string): Promise<boolean> {
  const r = await query("select 1 from public.sessions where id = $1 and user_id = $2", [
    sessionId,
    userId,
  ]);
  return (r.rowCount ?? 0) > 0;
}

export async function recordTurn(
  sessionId: string,
  role: "assistant" | "user",
  content: string,
): Promise<void> {
  await query(
    "insert into public.session_events (session_id, kind, role, content) values ($1,'turn',$2,$3)",
    [sessionId, role, content],
  );
}

export async function recordScore(
  sessionId: string,
  score: number,
  onTrack: boolean,
): Promise<void> {
  await query(
    "insert into public.session_events (session_id, kind, score, on_track) values ($1,'score',$2,$3)",
    [sessionId, score, onTrack],
  );
}

export async function endSession(
  sessionId: string,
  data: { finalScore: number; mastery: boolean; rationale: string | null },
): Promise<void> {
  await query(
    "update public.sessions set ended_at = now(), final_score = $2, mastery = $3, rationale = $4 where id = $1",
    [sessionId, data.finalScore, data.mastery, data.rationale],
  );
}

// ---- analytics (admin) ----

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

export async function listUserSessions(userId: string): Promise<SessionSummary[]> {
  const r = await query<SessionSummary>(
    `select s.id, s.started_at, s.ended_at, s.final_score, s.mastery, s.rationale, s.topics,
       count(e.id) filter (where e.kind='turn')::int as turn_count
     from public.sessions s
     left join public.session_events e on e.session_id = s.id
     group by s.id
     having s.user_id = $1
     order by s.started_at desc`,
    [userId],
  );
  return r.rows;
}

export interface SessionDetail {
  scoreSeries: { ts: string; score: number }[];
  turns: { ts: string; role: string; content: string }[];
  session: SessionSummary | null;
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  const scores = await query<{ ts: string; score: number }>(
    "select ts, score from public.session_events where session_id=$1 and kind='score' order by ts",
    [sessionId],
  );
  const turns = await query<{ ts: string; role: string; content: string }>(
    "select ts, role, content from public.session_events where session_id=$1 and kind='turn' order by ts",
    [sessionId],
  );
  const s = await query<SessionSummary>(
    `select id, started_at, ended_at, final_score, mastery, rationale, topics, 0 as turn_count
     from public.sessions where id = $1`,
    [sessionId],
  );
  return { scoreSeries: scores.rows, turns: turns.rows, session: s.rows[0] ?? null };
}
