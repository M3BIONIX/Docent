import { embedMany } from "ai";
import { embeddingModel } from "../../services/openai/openai.factory.js";

/**
 * Embeds texts with OpenAI text-embedding-3-small. Order is preserved so the
 * browser can zip vectors back onto their chunks. Vectors are L2-normalized by
 * the model, so client-side cosine reduces to a dot product.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel(),
    values: texts,
  });
  return embeddings;
}
