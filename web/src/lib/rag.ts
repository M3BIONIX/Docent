import type { ChunkRecord } from "./db";

const WORDS_PER_CHUNK = 180; // ~800 tokens
const OVERLAP_WORDS = 24;

/**
 * Split text into overlapping word-windows. Overlap preserves context that would
 * otherwise be severed at a chunk boundary.
 */
export function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= WORDS_PER_CHUNK) return [words.join(" ")];

  const chunks: string[] = [];
  const step = WORDS_PER_CHUNK - OVERLAP_WORDS;
  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + WORDS_PER_CHUNK);
    if (slice.length === 0) break;
    chunks.push(slice.join(" "));
    if (start + WORDS_PER_CHUNK >= words.length) break;
  }
  return chunks;
}

/**
 * Dot product. text-embedding-3-small returns L2-normalized vectors, so the dot
 * product equals cosine similarity — no normalization needed here.
 */
export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += a[i]! * b[i]!;
  return sum;
}

export interface RankedChunk {
  chunk: ChunkRecord;
  score: number;
}

/** Top-k chunks by similarity to the query vector. Brute force — fine for a few hundred chunks. */
export function cosineTopK(
  query: ArrayLike<number>,
  chunks: ChunkRecord[],
  k = 4,
): RankedChunk[] {
  return chunks
    .map((chunk) => ({ chunk, score: dot(query, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
