import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Check,
  Lock,
  Play,
  TrendingUp,
  Shield,
  FileText,
} from "lucide-react";
import { useSession, getOrbLevel, setMicMuted } from "@/store/useSession";
import { useAuth } from "@/store/useAuth";
import { VoiceOrb } from "./VoiceOrb";
import { Button } from "@/components/ui/button";

/** How many curriculum topics the current global score has "covered" — a
 * progress proxy over the ordered curriculum (the server scores the whole
 * corpus as one number, so this visualizes progress through it, not per-topic
 * truth). */
function coveredCount(score: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total, Math.round((Math.max(0, Math.min(100, score)) / 100) * total));
}

export function SessionScreen() {
  const phase = useSession((s) => s.phase);
  const score = useSession((s) => s.understandingScore);
  const mastery = useSession((s) => s.masteryReached);
  const rationale = useSession((s) => s.rationale);
  const speaking = useSession((s) => s.assistantSpeaking);
  const transcript = useSession((s) => s.transcript);
  const partial = useSession((s) => s.assistantPartial);
  const topics = useSession((s) => s.topics);
  const error = useSession((s) => s.error);
  const start = useSession((s) => s.start);
  const end = useSession((s) => s.end);

  const me = useAuth((s) => s.me);
  const [muted, setMuted] = useState(false);
  const docs = me?.documents ?? [];
  const hasDocs = docs.length > 0;

  // Keep the transcript pinned to the latest line as the conversation streams in.
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length, partial]);

  // ---------- idle ----------
  if (phase === "idle") {
    return (
      <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-7 px-6 text-center">
        <VoiceOrb getLevel={getOrbLevel} active={false} speaking={false} size={200} />
        {hasDocs ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-[26px] font-medium tracking-tight">
                Ready when you are, {me?.user.name?.split(" ")[0] ?? "there"}.
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
                You have {docs.length} document{docs.length > 1 ? "s" : ""} to work through. Your tutor
                teaches them by voice and checks that you can explain the ideas back in your own words.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3.5">
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="flex w-[212px] flex-col gap-3 rounded-lg border border-border p-4 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <FileText className="h-[17px] w-[17px]" />
                    </div>
                    <span className="truncate text-sm font-medium">{d.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {d.chunk_count ? `${d.chunk_count} sections` : "Ready to study"}
                  </span>
                </div>
              ))}
            </div>
            {error && <p className="text-xs text-muted-foreground">{error}</p>}
            <Button size="lg" onClick={start} className="h-12">
              <Play className="h-5 w-5" /> Start learning
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No documents have been assigned to you yet. Check back once your admin adds some.
          </p>
        )}
      </div>
    );
  }

  // ---------- preparing ----------
  if (phase === "preparing") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm text-muted-foreground">Preparing your tutor…</p>
      </div>
    );
  }

  // ---------- ended ----------
  if (phase === "ended") {
    return <SummaryView score={score} mastery={mastery} rationale={rationale} topics={topics} onRestart={start} />;
  }

  // ---------- live ----------
  const total = topics.length;
  const covered = coveredCount(score, total);
  const activeTopic = topics[covered] ?? topics[total - 1] ?? "your material";
  const lastAssistant = [...transcript].reverse().find((t) => t.role === "assistant");
  const lastUser = [...transcript].reverse().find((t) => t.role === "user");
  // Append the live, in-progress tutor line so it shows as it's spoken.
  const liveTranscript = partial
    ? [...transcript, { role: "assistant" as const, text: partial }]
    : transcript;
  const recent = liveTranscript.slice(-8);

  return (
    <div className="flex h-full flex-col">
      {/* session toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-2.5">
        <span className="flex items-center gap-2 text-[13px]">
          <span className={`h-2 w-2 rounded-full ${speaking ? "bg-foreground" : "bg-muted-foreground"}`} />
          {speaking ? "Tutor speaking" : "Listening"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setMicMuted(next);
            }}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={end}>
            <PhoneOff className="h-4 w-4" /> End session
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* curriculum */}
        <aside className="hidden w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border px-5 py-6 lg:flex">
          <div className="flex flex-col gap-2.5">
            <span className="text-xs text-muted-foreground">What you're learning</span>
            <div className="flex items-baseline justify-between">
              <span className="text-base font-medium">{total || 0} topics</span>
              <span className="text-[13px] text-muted-foreground">{covered} demonstrated</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            {topics.map((t, i) => {
              const stateDone = i < covered;
              const stateActive = i === covered;
              return (
                <div
                  key={t + i}
                  className={`flex h-10 items-center gap-2.5 rounded-md px-2.5 ${stateActive ? "bg-muted" : ""}`}
                >
                  {stateDone ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : stateActive ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      <span className="h-2 w-2 rounded-full bg-foreground" />
                    </span>
                  ) : (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={`truncate text-sm ${
                      stateActive ? "font-medium" : stateDone ? "" : "text-muted-foreground"
                    }`}
                  >
                    {t}
                  </span>
                  {stateActive && <span className="ml-auto text-[11px] text-muted-foreground">now</span>}
                </div>
              );
            })}
          </div>
        </aside>

        {/* center stage */}
        <div className="flex flex-1 flex-col items-center justify-center gap-7 px-10">
          <span className="text-[13px] text-muted-foreground">Now teaching · {activeTopic}</span>
          <VoiceOrb getLevel={getOrbLevel} active speaking={speaking} size={280} />
          <div className="flex max-w-[560px] flex-col items-center gap-3.5">
            <p className="text-center text-[22px] leading-snug">
              <StreamingText
                text={partial || lastAssistant?.text || "Listen — your tutor is about to begin."}
                active={Boolean(partial)}
              />
            </p>
            {lastUser && (
              <p className="text-center text-[15px] leading-relaxed text-muted-foreground">
                You: {lastUser.text}
              </p>
            )}
          </div>
        </div>

        {/* understanding panel */}
        <aside className="hidden w-[340px] shrink-0 flex-col gap-5 overflow-hidden border-l border-border px-6 py-6 lg:flex">
          <UnderstandingPanel score={score} covered={covered} total={total} activeTopic={activeTopic} />
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <span className="text-xs text-muted-foreground">Transcript</span>
            <div ref={transcriptRef} className="flex flex-col gap-3.5 overflow-y-auto pr-1">
              {recent.length === 0 && (
                <span className="text-[13px] text-muted-foreground">The conversation will appear here.</span>
              )}
              {recent.map((t, i) => {
                const streaming = Boolean(partial) && i === recent.length - 1 && t.role === "assistant";
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">
                      {t.role === "assistant" ? "Tutor" : "You"}
                    </span>
                    <span className={`text-[13px] leading-relaxed ${t.role === "user" ? "text-muted-foreground" : ""}`}>
                      <StreamingText text={t.text} active={streaming} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Approx speaking cadence used to advance the karaoke cursor. The transcript
// text streams in faster than it is spoken, so we pace the highlight by elapsed
// time (a base per word + extra per character) rather than by which word arrived
// last. Words already transcribed but not yet reached read dimmed.
const WORD_BASE_S = 0.18;
const PER_CHAR_S = 0.05;

/** Streamed text with a karaoke cursor: highlights the word being spoken now,
 *  dims words that have streamed in but aren't spoken yet. */
function StreamingText({ text, active }: { text: string; active?: boolean }) {
  const [idx, setIdx] = useState(0);
  const textRef = useRef(text);
  textRef.current = text;
  const idxRef = useRef(0);

  useEffect(() => {
    if (!active) {
      idxRef.current = 0;
      setIdx(0);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      const words = textRef.current.split(/\s+/).filter(Boolean);
      let acc = 0;
      let i = 0;
      for (; i < words.length; i++) {
        const d = WORD_BASE_S + PER_CHAR_S * words[i]!.length;
        if (acc + d > elapsed) break;
        acc += d;
      }
      const next = Math.min(i, Math.max(0, words.length - 1));
      if (next !== idxRef.current) {
        idxRef.current = next;
        setIdx(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return <>{text}</>;

  let wordI = -1;
  return (
    <>
      {text.split(/(\s+)/).map((tok, k) => {
        if (!tok.trim()) return <span key={k}>{tok}</span>;
        wordI++;
        const cls =
          wordI === idx
            ? "rounded bg-foreground/15 px-1 text-foreground"
            : wordI > idx
              ? "text-muted-foreground/50"
              : "";
        return (
          <span key={k} className={cls}>
            {tok}
          </span>
        );
      })}
    </>
  );
}

function UnderstandingPanel({
  score,
  covered,
  total,
  activeTopic,
}: {
  score: number;
  covered: number;
  total: number;
  activeTopic: string;
}) {
  const segments = Math.max(total, 1);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col">
        <span className="text-[44px] font-medium leading-none">{Math.round(score)}</span>
        <span className="mt-1.5 text-[13px] text-muted-foreground">Understanding</span>
      </div>
      <div className="flex h-2.5 w-full gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`h-full flex-1 rounded-sm ${
              i < covered ? "bg-foreground" : i === covered ? "bg-muted-foreground" : "bg-muted"
            }`}
          />
        ))}
      </div>
      <span className="text-[13px] text-muted-foreground">
        {covered} of {total || segments} topics demonstrated{total ? ` · ${activeTopic} in progress` : ""}
      </span>
      <div className="flex flex-col gap-2.5 rounded-md bg-muted p-3.5">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="h-[15px] w-[15px] shrink-0" />
          <span className="text-[13px]">Rises only when you explain in your own words</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Shield className="h-[15px] w-[15px] shrink-0" />
          <span className="text-[13px]">Background noise and silence never lower it</span>
        </div>
      </div>
    </div>
  );
}

function SummaryView({
  score,
  mastery,
  rationale,
  topics,
  onRestart,
}: {
  score: number;
  mastery: boolean;
  rationale: string | null;
  topics: string[];
  onRestart: () => void;
}) {
  const total = topics.length;
  const covered = coveredCount(score, total);
  return (
    <div className="mx-auto flex h-full max-w-[760px] flex-col items-center gap-7 overflow-y-auto px-6 pt-12">
      <div className="flex items-center gap-9">
        <ScoreRing score={score} />
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-muted-foreground">Session complete</span>
          <h1 className="flex items-center gap-2 text-[26px] font-medium tracking-tight">
            {mastery && <Check className="h-6 w-6" />}
            {mastery ? "Solid grasp — well done." : "Session ended."}
          </h1>
          <p className="max-w-[440px] text-[15px] leading-relaxed text-muted-foreground">
            {rationale ??
              (total
                ? `You demonstrated ${covered} of ${total} topics. Keep going to close the gap.`
                : "Start another session whenever you're ready.")}
          </p>
        </div>
      </div>

      {total > 0 && (
        <div className="flex w-full flex-col gap-1.5 rounded-lg border border-border p-6">
          <div className="flex items-baseline justify-between pb-2.5">
            <span className="text-[15px] font-medium">Topic breakdown</span>
            <span className="text-[13px] text-muted-foreground">{covered} of {total} demonstrated</span>
          </div>
          {topics.map((t, i) => {
            const done = i < covered;
            return (
              <div key={t + i} className="flex h-10 items-center gap-4 border-t border-border/60">
                <span className="w-[240px] truncate text-sm">{t}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${done ? "bg-foreground" : "bg-muted-foreground"}`} style={{ width: done ? "100%" : "42%" }} />
                </div>
                <span className={`w-[120px] text-right text-[13px] ${done ? "" : "text-muted-foreground"}`}>
                  {done ? "Demonstrated" : "Needs review"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Button onClick={onRestart} className="mb-12">
        <RotateCcw className="h-4 w-4" /> Start another session
      </Button>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="relative h-[150px] w-[150px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[38px] font-medium leading-none">{Math.round(score)}</span>
        <span className="mt-1 text-[12px] text-muted-foreground">understanding</span>
      </div>
    </div>
  );
}
