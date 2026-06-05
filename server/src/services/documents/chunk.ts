const WORDS_PER_CHUNK = 180;
const OVERLAP = 24;

/** Word-window chunking with overlap (mirrors the old client-side chunker). */
export function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= WORDS_PER_CHUNK) return [words.join(" ")];

  const chunks: string[] = [];
  const step = WORDS_PER_CHUNK - OVERLAP;
  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + WORDS_PER_CHUNK);
    if (slice.length === 0) break;
    chunks.push(slice.join(" "));
    if (start + WORDS_PER_CHUNK >= words.length) break;
  }
  return chunks;
}

/** pgvector literal: '[0.1,0.2,...]' */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
