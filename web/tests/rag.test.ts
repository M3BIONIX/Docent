import { describe, expect, it } from "vitest";
import { chunkText, dot, cosineTopK } from "@/lib/rag";
import type { ChunkRecord } from "@/lib/db";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkText("hello world this is short")).toHaveLength(1);
  });

  it("splits long text into overlapping chunks", () => {
    const text = Array.from({ length: 500 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    // overlap: the tail of chunk 0 should reappear at the head of chunk 1
    const tail0 = chunks[0]!.split(" ").slice(-10);
    const head1 = chunks[1]!.split(" ").slice(0, 24);
    expect(head1.some((w) => tail0.includes(w))).toBe(true);
  });

  it("returns empty array for empty text", () => {
    expect(chunkText("   ")).toEqual([]);
  });
});

describe("dot / cosineTopK", () => {
  it("dot product matches expectation", () => {
    expect(dot([1, 0, 0], [1, 0, 0])).toBe(1);
    expect(dot([1, 0], [0, 1])).toBe(0);
  });

  it("ranks the most similar chunk first and respects k", () => {
    const chunks: ChunkRecord[] = [
      { id: "a", docId: "d", idx: 0, text: "A", embedding: Float32Array.from([1, 0, 0]) },
      { id: "b", docId: "d", idx: 1, text: "B", embedding: Float32Array.from([0, 1, 0]) },
      { id: "c", docId: "d", idx: 2, text: "C", embedding: Float32Array.from([0.9, 0.1, 0]) },
    ];
    const ranked = cosineTopK(Float32Array.from([1, 0, 0]), chunks, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.chunk.text).toBe("A");
    expect(ranked[1]!.chunk.text).toBe("C");
  });
});
