import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { User, CheckCircle2 } from "lucide-react";
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

  const perSession = useMemo(
    () =>
      [...completed]
        .reverse()
        .map((s, i) => ({ name: `#${i + 1}`, score: s.final_score ?? 0 })),
    [completed],
  );

  const scoreOverTime = useMemo(
    () => (detail?.scoreSeries ?? []).map((p, i) => ({ name: `${i + 1}`, score: p.score })),
    [detail],
  );

  return (
    <div className="grid grid-cols-[200px_1fr] gap-6">
      {/* learner picker */}
      <div className="flex flex-col divide-y divide-border rounded-md border border-border">
        {learners.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">No learners.</p>
        )}
        {learners.map((l) => (
          <button
            key={l.id}
            onClick={() => setUserId(l.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
              userId === l.id && "bg-muted",
            )}
          >
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{l.name || l.email}</span>
            <span className="text-[11px] text-muted-foreground">{l.session_count}</span>
          </button>
        ))}
      </div>

      {/* dashboard */}
      <div className="flex flex-col gap-5">
        {!userId ? (
          <p className="rounded-md border border-dashed border-border px-3 py-10 text-center text-xs text-muted-foreground">
            Select a learner to see their understanding.
          </p>
        ) : sessions.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-10 text-center text-xs text-muted-foreground">
            This learner has not completed any sessions yet.
          </p>
        ) : (
          <>
            {/* summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Sessions" value={sessions.length} />
              <Stat label="Avg score" value={avg} />
              <Stat label="Best" value={best} />
              <Stat label="Mastered" value={masteryCount} icon />
            </div>

            {/* score across sessions */}
            <Card title="Final score by session">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={perSession}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke={MUTED} fontSize={11} />
                  <YAxis domain={[0, 100]} stroke={MUTED} fontSize={11} width={28} />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="score" fill={FG} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* session selector */}
            <div className="flex flex-wrap gap-2">
              {sessions.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setSessionId(s.id)}
                  className={cn(
                    "rounded-md border border-border px-3 py-1.5 text-xs",
                    sessionId === s.id ? "bg-foreground text-background" : "hover:bg-muted",
                  )}
                >
                  Session {sessions.length - i} · {s.final_score ?? "–"}
                  {s.mastery && " ★"}
                </button>
              ))}
            </div>

            {/* selected session detail */}
            {detail && (
              <div className="grid grid-cols-[1.4fr_1fr] gap-4">
                <Card title="Understanding over the conversation">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={scoreOverTime}>
                      <defs>
                        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={FG} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={FG} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" stroke={MUTED} fontSize={11} />
                      <YAxis domain={[0, 100]} stroke={MUTED} fontSize={11} width={28} />
                      <Tooltip {...tooltip} />
                      <Area type="monotone" dataKey="score" stroke={FG} strokeWidth={2} fill="url(#g)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="Final understanding">
                  <div className="flex items-center gap-2">
                    <ResponsiveContainer width="55%" height={160}>
                      <RadialBarChart
                        innerRadius="70%"
                        outerRadius="100%"
                        data={[{ name: "score", value: detail.session?.final_score ?? 0, fill: FG }]}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={8} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div>
                      <div className="text-3xl font-semibold tabular-nums">
                        {detail.session?.final_score ?? 0}
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        / 100
                      </div>
                      {detail.session?.mastery && (
                        <div className="mt-1 flex items-center gap-1 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" /> mastery
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                <Card title="Topics covered" className="col-span-2">
                  <div className="flex flex-wrap gap-2">
                    {(detail.session?.topics ?? []).map((t) => (
                      <span key={t} className="rounded-full border border-border px-2.5 py-1 text-xs">
                        {t}
                      </span>
                    ))}
                    {(detail.session?.topics?.length ?? 0) === 0 && (
                      <span className="text-xs text-muted-foreground">No topics recorded.</span>
                    )}
                  </div>
                  {detail.session?.rationale && (
                    <p className="mt-3 text-xs text-muted-foreground">{detail.session.rationale}</p>
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <MiniStat label="Turns" value={detail.turns.length} />
                    <MiniStat label="Score checks" value={detail.scoreSeries.length} />
                    <MiniStat
                      label="Engagement"
                      value={`${engagement(detail)}%`}
                    />
                  </div>
                </Card>

                {/* engagement donut */}
                <Card title="Engagement (on-topic share)" className="col-span-2">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "On topic", value: engagement(detail) },
                          { name: "Off", value: 100 - engagement(detail) },
                        ]}
                        dataKey="value"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={2}
                      >
                        <Cell fill={FG} />
                        <Cell fill="hsl(var(--muted))" />
                      </Pie>
                      <Tooltip {...tooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
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

function engagement(detail: SessionDetail): number {
  // share of score-check turns; proxy from rationale/score presence is unavailable,
  // so use a simple heuristic: scored turns vs total turns.
  if (detail.turns.length === 0) return 0;
  return Math.min(100, Math.round((detail.scoreSeries.length / Math.max(1, detail.turns.length / 2)) * 100));
}

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1 text-2xl font-semibold tabular-nums">
        {icon && <CheckCircle2 className="h-4 w-4" />}
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
