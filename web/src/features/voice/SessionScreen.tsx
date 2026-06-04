import { useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff, RotateCcw, CheckCircle2 } from "lucide-react";
import { useDocentStore, getOrbLevel, setMicMuted } from "@/store/useDocentStore";
import { VoiceOrb } from "./VoiceOrb";
import { Button } from "@/components/ui/button";

export function SessionScreen() {
  const phase = useDocentStore((s) => s.phase);
  const score = useDocentStore((s) => s.understandingScore);
  const mastery = useDocentStore((s) => s.masteryReached);
  const rationale = useDocentStore((s) => s.rationale);
  const speaking = useDocentStore((s) => s.assistantSpeaking);
  const transcript = useDocentStore((s) => s.transcript);
  const error = useDocentStore((s) => s.error);
  const endSession = useDocentStore((s) => s.endSession);
  const startSession = useDocentStore((s) => s.startSession);

  const [muted, setMuted] = useState(false);
  const lastLine = transcript[transcript.length - 1];

  if (phase === "preparing") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm text-muted-foreground">
          Reading your documents and preparing your tutor…
        </p>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <ScoreDial score={score} mastery={mastery} />
        <div>
          <p className="text-sm font-medium">{mastery ? "You've got a solid grasp." : "Session ended."}</p>
          {rationale && <p className="mt-1 text-xs text-muted-foreground">{rationale}</p>}
        </div>
        <Button onClick={startSession}>
          <RotateCcw className="h-4 w-4" />
          Start another session
        </Button>
      </div>
    );
  }

  // live
  return (
    <div className="flex h-full flex-col items-center justify-between py-8">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={speaking ? "font-medium text-foreground" : ""}>
          {speaking ? "Tutor speaking…" : "Listening…"}
        </span>
      </div>

      <div className="flex flex-col items-center gap-8">
        <VoiceOrb getLevel={getOrbLevel} active={phase === "live"} speaking={speaking} />
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
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={endSession}>
            <PhoneOff className="h-4 w-4" />
            End session
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Single global understanding score, 0-100. */
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
          {mastery && <CheckCircle2 className="h-3 w-3" />}
          understanding
        </span>
      </div>
    </div>
  );
}
