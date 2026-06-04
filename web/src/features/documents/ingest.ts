import { nanoid } from "nanoid";
import { db, type DocRecord } from "@/lib/db";
import { extractPdfText } from "@/lib/pdf";
import { chunkText, cosineTopK } from "@/lib/rag";
import { embed } from "@/lib/api";

/** Deterministic teaching intent for a doc (MVP: template, no LLM call). */
export function buildIntentSummary(title: string): string {
  return `Teach the document "${title}" to the learner and verify they understand its key points. Stay strictly within this document.`;
}

/**
 *  PDF file
 *    │ extractPdfText (pdf.js, client-side)
 *    ▼
 *  raw text ── chunkText ──► chunks ── POST /embed ──► vectors
 *    │                                                   │
 *    ├── db.documents.put({status:'ready'})              │
 *    ├── db.chunks.bulkPut({text, embedding}) ◄──────────┘
 *    └── db.intents.put(template intent)
 *
 *  On any failure the doc is marked 'failed' so the UI can offer a retry.
 */
export async function ingestPdf(file: File, order: number): Promise<DocRecord> {
  const id = nanoid();
  const title = file.name.replace(/\.pdf$/i, "");
  const doc: DocRecord = { id, title, text: "", order, status: "ingesting", createdAt: Date.now() };
  await db.documents.put(doc);

  try {
    const text = await extractPdfText(file);
    const chunks = chunkText(text);
    const vectors = await embed(chunks);

    if (vectors.length !== chunks.length) {
      throw new Error("Embedding count did not match chunk count");
    }

    await db.transaction("rw", db.documents, db.chunks, db.intents, async () => {
      await db.chunks.bulkPut(
        chunks.map((chunkContent, idx) => ({
          id: `${id}:${idx}`,
          docId: id,
          idx,
          text: chunkContent,
          embedding: Float32Array.from(vectors[idx]!),
        })),
      );
      await db.intents.put({ docId: id, intentSummary: buildIntentSummary(title), openingQuestion: null });
      await db.documents.put({ ...doc, text, status: "ready" });
    });

    return { ...doc, text, status: "ready" };
  } catch (error) {
    await db.documents.put({ ...doc, status: "failed" });
    throw error;
  }
}

/** Retrieve top-k chunk texts for a doc given a query embedding. */
export async function retrieveContext(
  docId: string,
  queryVector: number[],
  k = 4,
): Promise<string[]> {
  const chunks = await db.chunks.where("docId").equals(docId).toArray();
  if (chunks.length === 0) return [];
  return cosineTopK(Float32Array.from(queryVector), chunks, k).map((r) => r.chunk.text);
}
