import { nanoid } from "nanoid";
import { db, type DocRecord } from "@/lib/db";
import { extractPdfText } from "@/lib/pdf";

/**
 * v2 ingest: extract text client-side (pdf.js) and store it. No embeddings, no
 * chunking — the whole-corpus teaching plan is built server-side from the text
 * at session start (POST /api/plan).
 */
export async function ingestPdf(file: File, order: number): Promise<DocRecord> {
  const text = await extractPdfText(file);
  const doc: DocRecord = {
    id: nanoid(),
    title: file.name.replace(/\.pdf$/i, ""),
    text,
    order,
    createdAt: Date.now(),
  };
  await db.documents.put(doc);
  return doc;
}
