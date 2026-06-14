import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Check } from "lucide-react";
import {
  adminListUsers,
  adminGetUserSessions,
  adminGetSessionDetail,
  type AdminUser,
  type SessionSummary,
  type SessionDetail,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const FG = "hsl(var(--foreground))";
const MUTED = "hsl(var(--muted-foreground))";

function initials(u: AdminUser): string {
  const base = (u.name || u.email).trim();
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || base.slice(0, 2).toUpperCase();
}

export function AnalyticsTab() {
  const [learners, setLearners] = useState<AdminUser[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);

  useEffect(() => {
    void adminListUsers().then((u) => setLearners(u.filter((x) => x.role === "learner")));
  }, []);

  useEffect(() => {
    if (!userId) return;
    setSessionId(null);
    setDetail(null);
    void adminGetUserSessions(userId).then(setSessions);
  }, [userId]);

  useEffect(() => {
    if (!sessionId) return;
    void adminGetSessionDetail(sessionId).then(setDetail);
  }, [sessionId]);

  const completed = sessions.filter((s) => s.final_score !== null);
  const avg = completed.length
    ? Math.round(completed.reduce((a, s) => a + (s.final_score ?? 0), 0) / completed.length)
    : 0;
  const best = completed.reduce((a, s) => Math.max(a, s.final_score ?? 0), 0);
  const masteryCount = sessions.filter((s) => s.mastery).length;

  const trend = useMemo(
    () => [...completed].reverse().map((s, i) => ({ name: `#${i + 1}`, score: s.final_score ?? 0 })),
    [completed],
  );

  return (
    <div className="flex gap-8">
      {/* learner picker */}
      <div className="flex w-[220px] shrink-0 flex-col gap-0.5">
        {learners.length === 0 && (
          <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">No learners.</p>
        )}
        {learners.map((l) => (
          <button
            key={l.id}
            onClick={() => setUserId(l.id)}
            className={cn(
              "flex h-12 items-center gap-3 rounded-md px-2.5 text-left transition-colors hover:bg-muted",
              userId === l.id && "bg-muted",
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-medium text-background">
              {initials(l)}
            </div>
            <span className="flex-1 truncate text-sm">{l.name || l.email}</span>
          </button>
        ))}
      </div>

      {/* dashboard */}
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-medium">Understanding</h2>
          <p className="text-[13px] text-muted-foreground">
            How well learners can explain their material back
          </p>
        </div>

        {!userId ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-10 text-center text-[13px] text-muted-foreground">
            Select a learner to see their understanding.
          </p>
        ) : sessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-10 text-center text-[13px] text-muted-foreground">
            This learner has not completed any sessions yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Avg understanding" value={avg} />
              <Stat label="Best session" value={best} />
              <Stat label="Sessions" value={sessions.length} />
              <Stat label="Mastered" value={masteryCount} />
            </div>

            <div className="flex flex-col gap-4 rounded-lg border border-border p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-medium">Understanding over time</span>
                <span className="text-[13px] text-muted-foreground">Last {completed.length} sessions</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={FG} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={FG} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke={MUTED} fontSize={11} />
                  <YAxis domain={[0, 100]} stroke={MUTED} fontSize={11} width={28} />
                  <Tooltip {...tooltip} />
                  <Area type="monotone" dataKey="score" stroke={FG} strokeWidth={2.5} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* session list */}
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex h-11 items-center bg-muted/60 px-4 text-xs text-muted-foreground">
                <span className="flex-1">Session</span>
                <span className="w-[160px]">Understanding</span>
                <span className="w-[120px]">Result</span>
              </div>
              {sessions.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setSessionId(s.id)}
                  className={cn(
                    "flex h-[52px] w-full items-center px-4 text-left",
                    i > 0 && "border-t border-border/60",
                    sessionId === s.id && "bg-muted",
                  )}
                >
                  <span className="flex-1 text-sm font-medium">Session {sessions.length - i}</span>
                  <div className="flex w-[160px] items-center gap-3 pr-6">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground" style={{ width: `${s.final_score ?? 0}%` }} />
                    </div>
                    <span className="w-8 text-right text-[13px] text-muted-foreground">{s.final_score ?? "–"}</span>
                  </div>
                  <span className="flex w-[120px] items-center gap-1.5 text-[13px]">
                    {s.mastery ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Mastered
                      </>
                    ) : (
                      <span className="text-muted-foreground">In progress</span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* selected session detail */}
            {detail && detail.session && (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-medium">Session detail</span>
                  <span className="text-[13px] text-muted-foreground">
                    {detail.session.final_score ?? 0} understanding · {detail.turns.length} turns
                  </span>
                </div>
                {detail.session.rationale && (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{detail.session.rationale}</p>
                )}
                {(detail.session.topics?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.session.topics.map((t) => (
                      <span key={t} className="rounded-md bg-muted px-2.5 py-1 text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const tooltip = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
} as const;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-[28px] font-medium leading-none tabular-nums">{value}</span>
    </div>
  );
}
