import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  db,
  updateTopicScore,
  type DocRecord,
  type MessageRecord,
  type TopicScoreRecord,
} from "@/lib/db";
import { embed, streamTurn, type TurnVerdict } from "@/lib/api";
import { ingestPdf, retrieveContext } from "@/features/documents/ingest";

interface DocentState {
  sessionId: string;
  docs: DocRecord[];
  activeDocId: string | null;
  messages: MessageRecord[];
  scores: Record<string, TopicScoreRecord>;
  streamingText: string;
  busy: boolean;
  error: string | null;

  init: () => Promise<void>;
  addPdf: (file: File) => Promise<void>;
  setActiveDoc: (docId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  beginSession: () => Promise<void>;
  clearError: () => void;
}

async function loadScores(): Promise<Record<string, TopicScoreRecord>> {
  const all = await db.topicScores.toArray();
  return Object.fromEntries(all.map((s) => [s.docId, s]));
}

export const useDocentStore = create<DocentState>((set, get) => ({
  sessionId: nanoid(),
  docs: [],
  activeDocId: null,
  messages: [],
  scores: {},
  streamingText: "",
  busy: false,
  error: null,

  init: async () => {
    const docs = await db.documents.orderBy("order").toArray();
    set({ docs, scores: await loadScores() });
  },

  addPdf: async (file) => {
    set({ busy: true, error: null });
    try {
      const order = get().docs.length;
      await ingestPdf(file, order);
      const docs = await db.documents.orderBy("order").toArray();
      set({ docs });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to process document" });
    } finally {
      set({ busy: false });
    }
  },

  setActiveDoc: async (docId) => {
    const messages = await db.messages.where("docId").equals(docId).sortBy("ts");
    set({ activeDocId: docId, messages, streamingText: "" });
  },

  beginSession: async () => {
    const { activeDocId, messages } = get();
    if (!activeDocId || messages.length > 0) return;
    await get().sendMessage("I'm ready. Please start teaching me this document.");
  },

  sendMessage: async (text) => {
    const { activeDocId, sessionId } = get();
    if (!activeDocId || !text.trim() || get().busy) return;

    const docId = activeDocId;
    const intent = await db.intents.get(docId);
    if (!intent) {
      set({ error: "Document is still being prepared." });
      return;
    }

    set({ busy: true, error: null, streamingText: "" });

    // persist + show the user's message
    const userMsg: MessageRecord = {
      id: nanoid(),
      sessionId,
      docId,
      role: "user",
      text: text.trim(),
      ts: Date.now(),
    };
    await db.messages.put(userMsg);
    set({ messages: [...get().messages, userMsg] });

    try {
      // RAG retrieval (client-side): embed the query, cosine top-k over this doc's chunks
      const [queryVector] = await embed([text.trim()]);
      const context = queryVector ? await retrieveContext(docId, queryVector, 4) : [];

      const history = get()
        .messages.slice(-10)
        .map((m) => ({ role: m.role, text: m.text }));

      let verdict: TurnVerdict | null = null;
      let advance = false;
      let acc = "";

      await streamTurn(
        {
          sessionId,
          docId,
          intent: { summary: intent.intentSummary, openingQuestion: intent.openingQuestion },
          history,
          latestUserMessage: text.trim(),
          context,
        },
        {
          onVerdict: (v) => {
            verdict = v;
          },
          onToken: (delta) => {
            acc += delta;
            set({ streamingText: acc });
          },
          onDone: (info) => {
            advance = info.advanceToNextDoc;
          },
          onError: (err) => {
            set({ error: `${err.code}: ${err.message}` });
          },
        },
      );

      if (acc.trim()) {
        const assistantMsg: MessageRecord = {
          id: nanoid(),
          sessionId,
          docId,
          role: "assistant",
          text: acc.trim(),
          ts: Date.now(),
        };
        await db.messages.put(assistantMsg);
        set({ messages: [...get().messages, assistantMsg], streamingText: "" });
      }

      if (verdict) {
        await updateTopicScore(docId, (verdict as TurnVerdict).understandingScore);
      }
      if (advance) {
        const existing = await db.topicScores.get(docId);
        await db.topicScores.put({
          docId,
          understanding: existing?.understanding ?? 80,
          turns: existing?.turns ?? 1,
          mastered: true,
          updatedAt: Date.now(),
        });
      }
      set({ scores: await loadScores() });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Turn failed" });
    } finally {
      set({ busy: false });
    }
  },

  clearError: () => set({ error: null }),
}));
