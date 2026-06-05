import { useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff, RotateCcw, CheckCircle2, Play } from "lucide-react";
import { useSession, getOrbLevel, setMicMuted } from "@/store/useSession";
import { useAuth } from "@/store/useAuth";
import { VoiceOrb } from "./VoiceOrb";
import { Button } from "@/components/ui/button";

export function SessionScreen() {
  const phase = useSession((s) => s.phase);
  const score = useSession((s) => s.understandingScore);
  const mastery = useSession((s) => s.masteryReached);
  const rationale = useSession((s) => s.rationale);
  const speaking = useSession((s) => s.assistantSpeaking);
  const transcript = useSession((s) => s.transcript);
  const error = useSession((s) => s.error);
  const start = useSession((s) => s.start);
  const end = useSession((s) => s.end);

  const me = useAuth((s) => s.me);
  const [muted, setMuted] = useState(false);
  const lastLine = transcript[transcript.length - 1];
  const hasDocs = (me?.documents.length ?? 0) > 0;

  if (phase === "idle") {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <VoiceOrb getLevel={getOrbLevel} active={false} speaking={false} size={200} />
        {hasDocs ? (
          <>
            <div>
              <p className="text-sm font-medium">Ready when you are, {me?.user.name ?? "there"}.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your tutor will teach {me?.documents.length} document
                {me!.documents.length > 1 ? "s" : ""} by voice and check your understanding.
              </p>
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

  if (phase === "preparing") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm text-muted-foreground">Preparing your tutor…</p>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <ScoreDial score={score} mastery={mastery} />
        <div>
          <p className="text-sm font-medium">{mastery ? "Solid grasp — well done." : "Session ended."}</p>
          {rationale && <p className="mt-1 text-xs text-muted-foreground">{rationale}</p>}
        </div>
        <Button onClick={start}>
          <RotateCcw className="h-4 w-4" /> Start another session
        </Button>
      </div>
    );
  }

  // live
  return (
    <div className="flex h-full flex-col items-center justify-between py-8">
      <div className="text-xs text-muted-foreground">
        <span className={speaking ? "font-medium text-foreground" : ""}>
          {speaking ? "Tutor speaking…" : "Listening…"}
        </span>
      </div>
      <div className="flex flex-col items-center gap-8">
        <VoiceOrb getLevel={getOrbLevel} active speaking={speaking} />
        <ScoreDial score={score} mastery={mastery} />
        {lastLine && (
          <p className="max-w-md px-6 text-center text-sm text-muted-foreground line-clamp-2">
            {lastLine.role === "assistant" ? "" : "You: "}
            {lastLine.text}
          </p>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
        <div className="flex items-center gap-3">
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
    </div>
  );
}

function ScoreDial({ score, mastery }: { score: number; mastery: boolean }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="relative h-32 w-32">
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
        <span className="text-3xl font-semibold tabular-nums">{Math.round(score)}</span>
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {mastery && <CheckCircle2 className="h-3 w-3" />} understanding
        </span>
      </div>
    </div>
  );
}
