import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("HTTP surface", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
  });

  it("POST /api/plan rejects empty docs (zod 400)", async () => {
    const res = await request(app).post("/api/plan").send({ docs: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/evaluate rejects an out-of-range priorScore (zod 400)", async () => {
    // keep the suite offline: send an invalid body so it fails validation
    // before reaching the OpenAI-backed service.
    const res = await request(app).post("/api/evaluate").send({ priorScore: 200 });
    expect(res.status).toBe(400);
  });

  it("POST /api/realtime/session rejects a missing sdp (zod 400)", async () => {
    const res = await request(app).post("/api/realtime/session").send({ instructions: "teach" });
    expect(res.status).toBe(400);
  });
});
