import { afterEach, describe, expect, it } from "vitest";
import { db, loadDocuments, type DocRecord } from "@/lib/db";

afterEach(async () => {
  await db.documents.clear();
});

const doc = (over: Partial<DocRecord> = {}): DocRecord => ({
  id: "d1",
  title: "Doc 1",
  text: "hello world",
  order: 0,
  createdAt: 1,
  ...over,
});

describe("documents persistence (v2)", () => {
  it("stores and loads a document", async () => {
    await db.documents.put(doc());
    const loaded = await db.documents.get("d1");
    expect(loaded?.title).toBe("Doc 1");
    expect(loaded?.text).toBe("hello world");
  });

  it("loadDocuments returns documents ordered by `order`", async () => {
    await db.documents.bulkPut([
      doc({ id: "b", title: "B", order: 1 }),
      doc({ id: "a", title: "A", order: 0 }),
      doc({ id: "c", title: "C", order: 2 }),
    ]);
    const docs = await loadDocuments();
    expect(docs.map((d) => d.title)).toEqual(["A", "B", "C"]);
  });

  it("deletes a document", async () => {
    await db.documents.put(doc());
    await db.documents.delete("d1");
    expect(await db.documents.get("d1")).toBeUndefined();
  });
});
