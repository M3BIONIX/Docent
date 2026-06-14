import { create } from "zustand";
import { RealtimeClient } from "@/features/voice/realtime-client";
import { startSession, postTurn, postScore, endSessionApi, evaluate } from "@/lib/api";

export type Phase = "idle" | "preparing" | "live" | "ended";

interface TranscriptEntry {
  role: "assistant" | "user";
  text: string;
}

interface SessionState {
  phase: Phase;
  sessionId: string | null;
  topics: string[];
  transcript: TranscriptEntry[];
  understandingScore: number;
  masteryReached: boolean;
  rationale: string | null;
  assistantSpeaking: boolean;
  /** Live, in-progress tutor transcript streamed word-by-word as it speaks. */
  assistantPartial: string;
  error: string | null;

  start: () => Promise<void>;
  end: () => Promise<void>;
  clearError: () => void;
}

let client: RealtimeClient | null = null;
let evaluating = false;

function isSubstantiveTurn(text: string): boolean {
  const clean = text.replace(/\s+/g, " ").trim();
  const words = clean.split(" ").filter(Boolean);
  return clean.length >= 10 && words.length >= 3;
}

export function getOrbLevel(): number {
  return client?.getLevel() ?? 0;
}
export function setMicMuted(muted: boolean): void {
  client?.setMuted(muted);
}

export const useSession = create<SessionState>((set, get) => ({
  phase: "idle",
  sessionId: null,
  topics: [],
  transcript: [],
  understandingScore: 0,
  masteryReached: false,
  rationale: null,
  assistantSpeaking: false,
  assistantPartial: "",
  error: null,

  start: async () => {
    if (get().phase === "preparing" || get().phase === "live") return;
    set({
      phase: "preparing",
      error: null,
      transcript: [],
      understandingScore: 0,
      masteryReached: false,
      rationale: null,
      assistantPartial: "",
    });
    try {
      const { sessionId, instructions, topics } = await startSession();
      set({ sessionId, topics });

      client = new RealtimeClient({
        onConnected: () => set({ phase: "live" }),
        onDisconnected: () => {
          const phase = get().phase;
          if (phase === "live") void get().end();
          else if (phase === "preparing")
            set({ phase: "idle", error: get().error ?? "Voice connection failed. Check microphone permissions." });
        },
        onError: (message) => set({ error: message }),
        onSpeakingChange: (speaking) => {
          if (speaking) {
            set({ assistantSpeaking: true });
            return;
          }
          // Audio finished — THIS is when the turn is truly over. Commit the spoken
          // line now (not when the transcript text finished generating, which happens
          // much earlier), so the karaoke highlight runs to the end of the speech.
          const pending = get().assistantPartial.trim();
          if (pending) {
            set({
              assistantSpeaking: false,
              assistantPartial: "",
              transcript: [...get().transcript, { role: "assistant", text: pending }],
            });
            void postTurn(sessionId, "assistant", pending).catch(() => undefined);
          } else {
            set({ assistantSpeaking: false });
          }
        },
        onAssistantDelta: (delta) =>
          set({ assistantPartial: get().assistantPartial + delta, assistantSpeaking: true }),
        onAssistantTranscript: (text) => {
          // The full transcript is ready, but the tutor is usually still speaking it.
          // Replace the buffer with the authoritative full text and keep streaming the
          // highlight; only commit early if the audio has somehow already stopped.
          if (get().assistantSpeaking) {
            set({ assistantPartial: text });
          } else {
            set({ transcript: [...get().transcript, { role: "assistant", text }], assistantPartial: "" });
            void postTurn(sessionId, "assistant", text).catch(() => undefined);
          }
        },
        onUserTranscript: (text) => {
          set({ transcript: [...get().transcript, { role: "user", text }] });
          void postTurn(sessionId, "user", text).catch(() => undefined);
          if (isSubstantiveTurn(text)) {
            void runEvaluation(set, get);
          }
        },
        onEndSession: () => void get().end(),
      });
      await client.start(instructions);
    } catch (e) {
      await client?.stop().catch(() => undefined);
      client = null;
      set({ phase: "idle", error: e instanceof Error ? e.message : "Could not start the session" });
    }
  },

  end: async () => {
    const { sessionId, understandingScore, masteryReached, rationale } = get();
    await client?.stop().catch(() => undefined);
    client = null;
    if (sessionId) {
      await endSessionApi(sessionId, {
        finalScore: understandingScore,
        mastery: masteryReached,
        rationale,
      }).catch(() => undefined);
    }
    set({ phase: "ended", assistantSpeaking: false, assistantPartial: "" });
  },

  clearError: () => set({ error: null }),
}));

async function runEvaluation(
  set: (partial: Partial<SessionState>) => void,
  get: () => SessionState,
) {
  if (evaluating) return;
  evaluating = true;
  try {
    const { transcript, topics, understandingScore, sessionId } = get();
    const result = await evaluate({ transcript, topics, priorScore: understandingScore });
    set({
      understandingScore: result.understandingScore,
      masteryReached: result.masteryReached,
      rationale: result.rationale,
    });
    if (sessionId) void postScore(sessionId, result.understandingScore, result.onTrack).catch(() => undefined);
    if (!result.onTrack && (result.realignmentNote || result.nextProbe)) {
      client?.steer([result.realignmentNote, result.nextProbe].filter(Boolean).join(" "));
    }
  } catch {
    /* transient */
  } finally {
    evaluating = false;
  }
}
