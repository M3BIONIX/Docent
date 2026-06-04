import { afterEach, describe, expect, it } from "vitest";
import { db, updateTopicScore, type ChunkRecord } from "@/lib/db";

afterEach(async () => {
  await db.chunks.clear();
  await db.topicScores.clear();
});

describe("Dexie persistence", () => {
  it("round-trips a Float32Array embedding through IndexedDB", async () => {
    const rec: ChunkRecord = {
      id: "x:0",
      docId: "x",
      idx: 0,
      text: "chunk",
      embedding: Float32Array.from([0.1, 0.2, 0.3]),
    };
    await db.chunks.put(rec);
    const loaded = await db.chunks.get("x:0");
    expect(loaded).toBeDefined();
    expect(Array.from(loaded!.embedding)).toHaveLength(3);
    expect(loaded!.embedding[1]).toBeCloseTo(0.2, 5);
  });

  it("queries chunks by docId", async () => {
    await db.chunks.bulkPut([
      { id: "d:0", docId: "d", idx: 0, text: "a", embedding: Float32Array.from([1]) },
      { id: "d:1", docId: "d", idx: 1, text: "b", embedding: Float32Array.from([1]) },
      { id: "e:0", docId: "e", idx: 0, text: "c", embedding: Float32Array.from([1]) },
    ]);
    const dChunks = await db.chunks.where("docId").equals("d").toArray();
    expect(dChunks).toHaveLength(2);
  });
});

describe("updateTopicScore", () => {
  it("blends scores and flags mastery at >=80", async () => {
    await updateTopicScore("d", 100);
    let s = await db.topicScores.get("d");
    expect(s!.understanding).toBe(40); // 0*0.6 + 100*0.4
    await updateTopicScore("d", 100);
    s = await db.topicScores.get("d");
    expect(s!.understanding).toBe(64); // 40*0.6 + 100*0.4
    await updateTopicScore("d", 100);
    s = await db.topicScores.get("d");
    expect(s!.understanding).toBe(78);
    await updateTopicScore("d", 100);
    s = await db.topicScores.get("d");
    expect(s!.mastered).toBe(true);
  });

  it("ignores null turn scores", async () => {
    await updateTopicScore("d", null);
    expect(await db.topicScores.get("d")).toBeUndefined();
  });
});
