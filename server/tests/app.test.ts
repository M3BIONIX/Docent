import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("HTTP surface", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
  });

  it("POST /embed rejects an empty body (zod 400)", async () => {
    const res = await request(app).post("/embed").send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("POST /embed rejects an empty texts array", async () => {
    const res = await request(app).post("/embed").send({ texts: [] });
    expect(res.status).toBe(400);
  });

  it("POST /turn rejects a missing latestUserMessage (zod 400)", async () => {
    const res = await request(app)
      .post("/turn")
      .send({ sessionId: "s", docId: "d", intent: { summary: "x" }, history: [] });
    expect(res.status).toBe(400);
  });
});
