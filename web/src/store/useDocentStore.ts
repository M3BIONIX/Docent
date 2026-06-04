import { create } from "zustand";
import { loadDocuments, db, type DocRecord } from "@/lib/db";
import { ingestPdf } from "@/features/documents/ingest";
import { planCorpus, evaluate, type PlanResponse } from "@/lib/api";
import { RealtimeClient } from "@/features/voice/realtime-client";

export type Phase = "upload" | "preparing" | "ready" | "live" | "ended";

interface TranscriptEntry {
  role: "assistant" | "user";
  text: string;
}

interface DocentState {
  phase: Phase;
  docs: DocRecord[];
  plan: PlanResponse | null;
  transcript: TranscriptEntry[];
  understandingScore: number;
  masteryReached: boolean;
  rationale: string | null;
  assistantSpeaking: boolean;
  busy: boolean;
  error: string | null;

  init: () => Promise<void>;
  addPdf: (file: File) => Promise<void>;
  removeDoc: (id: string) => Promise<void>;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  clearError: () => void;
}

// The realtime client and an evaluate guard live outside React state (no re-renders).
let client: RealtimeClient | null = null;
let evaluating = false;

/** Stable accessor for the orb's audio level. */
export function getOrbLevel(): number {
  return client?.getLevel() ?? 0;
}

/** Mute/unmute the microphone on the live session. */
export function setMicMuted(muted: boolean): void {
  client?.setMuted(muted);
}

export const useDocentStore = create<DocentState>((set, get) => ({
  phase: "upload",
  docs: [],
  plan: null,
  transcript: [],
  understandingScore: 0,
  masteryReached: false,
  rationale: null,
  assistantSpeaking: false,
  busy: false,
  error: null,

  init: async () => {
    set({ docs: await loadDocuments() });
  },

  addPdf: async (file) => {
    set({ busy: true, error: null });
    try {
      await ingestPdf(file, get().docs.length);
      set({ docs: await loadDocuments() });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Could not read that PDF" });
    } finally {
      set({ busy: false });
    }
  },

  removeDoc: async (id) => {
    await db.documents.delete(id);
    set({ docs: await loadDocuments() });
  },

  startSession: async () => {
    const docs = get().docs;
    if (docs.length === 0 || get().busy) return;

    set({ phase: "preparing", busy: true, error: null, transcript: [], understandingScore: 0, masteryReached: false, rationale: null });

    try {
      // 1. Build the whole-corpus teaching brief from ALL docs.
      const plan = await planCorpus(docs.map((d) => ({ title: d.title, text: d.text })));
      set({ plan });

      // 2. Connect the voice session.
      client = new RealtimeClient({
        onConnected: () => set({ phase: "live" }),
        onDisconnected: () => {
          if (get().phase === "live") set({ phase: "ended" });
        },
        onError: (message) => set({ error: message }),
        onSpeakingChange: (speaking) => set({ assistantSpeaking: speaking }),
        onAssistantTranscript: (text) => {
          set({ transcript: [...get().transcript, { role: "assistant", text }] });
        },
        onUserTranscript: (text) => {
          set({ transcript: [...get().transcript, { role: "user", text }] });
          void runEvaluation(set, get);
        },
        onEndSession: () => void get().endSession(),
      });

      await client.start(plan.instructions);
    } catch (e) {
      set({ phase: "ready", error: e instanceof Error ? e.message : "Could not start the session" });
    } finally {
      set({ busy: false });
    }
  },

  endSession: async () => {
    await client?.stop();
    client = null;
    set({ phase: "ended", assistantSpeaking: false });
  },

  clearError: () => set({ error: null }),
}));

/**
 * Sideband evaluation: after each learner turn, score understanding globally and
 * steer the agent if the learner is drifting. One evaluation in flight at a time.
 */
async function runEvaluation(
  set: (partial: Partial<DocentState>) => void,
  get: () => DocentState,
) {
  if (evaluating) return;
  evaluating = true;
  try {
    const { transcript, plan, understandingScore } = get();
    const result = await evaluate({
      transcript,
      topics: plan?.topics ?? [],
      priorScore: understandingScore,
    });
    set({
      understandingScore: result.understandingScore,
      masteryReached: result.masteryReached,
      rationale: result.rationale,
    });
    if (!result.onTrack && (result.realignmentNote || result.nextProbe)) {
      const correction = [result.realignmentNote, result.nextProbe].filter(Boolean).join(" ");
      client?.steer(correction);
    }
  } catch {
    /* transient; next turn will re-evaluate */
  } finally {
    evaluating = false;
  }
}
