import Dexie, { type Table } from "dexie";

export interface DocRecord {
  id: string;
  title: string;
  text: string;
  order: number;
  /** "ready" once chunks + intent are persisted; "failed" if ingest errored. */
  status: "ingesting" | "ready" | "failed";
  createdAt: number;
}

export interface ChunkRecord {
  id: string;
  docId: string;
  idx: number;
  text: string;
  /** 1536-dim embedding, stored inline as a typed array (IndexedDB persists these natively). */
  embedding: Float32Array;
}

export interface MessageRecord {
  id: string;
  sessionId: string;
  docId: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
}

export interface TopicScoreRecord {
  docId: string;
  understanding: number; // 0-100, rolling
  turns: number;
  mastered: boolean;
  updatedAt: number;
}

export interface IntentRecord {
  docId: string;
  intentSummary: string;
  openingQuestion: string | null;
}

export class DocentDB extends Dexie {
  documents!: Table<DocRecord, string>;
  chunks!: Table<ChunkRecord, string>;
  messages!: Table<MessageRecord, string>;
  topicScores!: Table<TopicScoreRecord, string>;
  intents!: Table<IntentRecord, string>;

  constructor() {
    super("docent");
    this.version(1).stores({
      documents: "id, order, status",
      chunks: "id, docId, [docId+idx]",
      messages: "id, sessionId, docId, ts",
      topicScores: "docId",
      intents: "docId",
    });
  }
}

export const db = new DocentDB();

/** Rolling understanding score: exponential-ish blend so a single bad turn doesn't tank mastery. */
export async function updateTopicScore(docId: string, turnScore: number | null): Promise<void> {
  if (turnScore === null) return;
  const existing = await db.topicScores.get(docId);
  const prior = existing?.understanding ?? 0;
  const turns = (existing?.turns ?? 0) + 1;
  const blended = Math.round(prior * 0.6 + turnScore * 0.4);
  await db.topicScores.put({
    docId,
    understanding: blended,
    turns,
    mastered: blended >= 80,
    updatedAt: Date.now(),
  });
}
