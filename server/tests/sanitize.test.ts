import { describe, expect, it } from "vitest";
import { sanitizeText, chunkText } from "../src/services/documents/chunk.js";

describe("sanitizeText", () => {
  it("removes NUL bytes that Postgres text columns reject", () => {
    const nul = String.fromCharCode(0);
    const out = sanitizeText(`Photosynthesis${nul} uses${nul} light`);
    expect(out).not.toContain(nul);
    expect(out).toContain("Photosynthesis");
    expect(out).toContain("light");
  });

  it("strips other C0 control bytes but keeps tab/newline/return", () => {
    const s = `a${String.fromCharCode(7)}b\tc\nd\re`;
    const out = sanitizeText(s);
    expect(out).not.toContain(String.fromCharCode(7));
    expect(out).toContain("\t");
    expect(out).toContain("\n");
    expect(out).toContain("\r");
  });

  it("leaves clean text untouched (modulo control chars)", () => {
    expect(sanitizeText("normal text 123")).toBe("normal text 123");
  });

  it("chunking a sanitized doc never carries a NUL into chunks", () => {
    const nul = String.fromCharCode(0);
    const text = sanitizeText(`word${nul} `.repeat(500));
    for (const c of chunkText(text)) expect(c).not.toContain(nul);
  });
});
