import Dexie, { type Table } from "dexie";

export interface DocRecord {
  id: string;
  title: string;
  text: string;
  order: number;
  createdAt: number;
}

/**
 * v2 is voice-first and whole-corpus: we only persist the uploaded documents.
 * The teaching plan and the single understanding score live in the session
 * store (re-derived each session). No per-doc state, no embeddings.
 */
export class DocentDB extends Dexie {
  documents!: Table<DocRecord, string>;

  constructor() {
    super("docent");
    // v2 schema: drop the old per-doc tables (chunks, messages, topicScores, intents).
    this.version(2)
      .stores({
        documents: "id, order",
        chunks: null,
        messages: null,
        topicScores: null,
        intents: null,
      })
      .upgrade(() => {
        /* old per-doc tables are dropped by setting them to null above */
      });
  }
}

export const db = new DocentDB();

export async function loadDocuments(): Promise<DocRecord[]> {
  return db.documents.orderBy("order").toArray();
}
