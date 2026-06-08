import { embedMany } from "ai";
import { embeddingModel } from "../openai/openai.factory.js";
import { getPool, query } from "../db/pool.js";
import { chunkText, toVectorLiteral, sanitizeText } from "./chunk.js";

export interface DocumentRow {
  id: string;
  title: string;
  created_at: string;
  chunk_count?: number;
}

/** Create a document, chunk + embed it (OpenAI), and store chunks in pgvector. */
export async function createDocument(input: {
  title: string;
  text: string;
  createdBy: string;
}): Promise<DocumentRow> {
  // PDF-extracted text can contain NUL/control bytes that Postgres text columns
  // reject (causing a 500). Sanitize before storing or embedding.
  const title = sanitizeText(input.title).trim() || "Untitled";
  const text = sanitizeText(input.text);

  // Embed first (the slow, failure-prone step) so the transaction stays short.
  const chunks = chunkText(text);
  const embeddings = chunks.length
    ? (await embedMany({ model: embeddingModel(), values: chunks })).embeddings
    : [];

  // Doc + chunks in ONE transaction: a failure can't leave an orphan doc (a row
  // with no embedded chunks). Rolls back on any error.
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const doc = await client.query<{ id: string; title: string; created_at: string }>(
      "insert into public.documents (title, text, created_by) values ($1,$2,$3) returning id, title, created_at",
      [title, text, input.createdBy],
    );
    const documentId = doc.rows[0]!.id;

    if (chunks.length > 0) {
      const values: string[] = [];
      const params: unknown[] = [];
      chunks.forEach((content, i) => {
        const base = i * 4;
        values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::vector)`);
        params.push(documentId, i, content, toVectorLiteral(embeddings[i]!));
      });
      await client.query(
        `insert into public.document_chunks (document_id, idx, content, embedding) values ${values.join(",")}`,
        params,
      );
    }

    await client.query("commit");
    return doc.rows[0]!;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function listDocuments(): Promise<DocumentRow[]> {
  const r = await query<DocumentRow>(
    `select d.id, d.title, d.created_at, count(c.id)::int as chunk_count
     from public.documents d
     left join public.document_chunks c on c.document_id = d.id
     group by d.id order by d.created_at desc`,
  );
  return r.rows;
}

export async function deleteDocument(id: string): Promise<void> {
  await query("delete from public.documents where id = $1", [id]);
}

/** Documents assigned to a learner (metadata only). */
export async function getAssignedDocuments(userId: string): Promise<DocumentRow[]> {
  const r = await query<DocumentRow>(
    `select d.id, d.title, d.created_at
     from public.user_documents ud
     join public.documents d on d.id = ud.document_id
     where ud.user_id = $1 order by d.title`,
    [userId],
  );
  return r.rows;
}

/** Full text of a learner's assigned documents (for building the teaching plan). */
export async function getAssignedDocumentTexts(
  userId: string,
): Promise<{ title: string; text: string }[]> {
  const r = await query<{ title: string; text: string }>(
    `select d.title, d.text
     from public.user_documents ud
     join public.documents d on d.id = ud.document_id
     where ud.user_id = $1 order by d.title`,
    [userId],
  );
  return r.rows;
}

/** pgvector similarity search across a learner's assigned documents. */
export async function searchAssignedChunks(
  userId: string,
  queryEmbedding: number[],
  k = 6,
): Promise<{ content: string; title: string; distance: number }[]> {
  const r = await query<{ content: string; title: string; distance: number }>(
    `select c.content, d.title, (c.embedding <=> $2::vector) as distance
     from public.document_chunks c
     join public.documents d on d.id = c.document_id
     join public.user_documents ud on ud.document_id = c.document_id
     where ud.user_id = $1
     order by c.embedding <=> $2::vector
     limit $3`,
    [userId, toVectorLiteral(queryEmbedding), k],
  );
  return r.rows;
}
