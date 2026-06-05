import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("HTTP surface", () => {
  it("GET /api/health returns ok (public)", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
  });

  it("protected routes reject requests without a bearer token (401)", async () => {
    for (const r of [
      request(app).get("/api/me"),
      request(app).post("/api/session/start"),
      request(app).post("/api/evaluate").send({ topics: ["a"] }),
      request(app).get("/api/admin/users"),
    ]) {
      const res = await r;
      expect(res.status).toBe(401);
    }
  });

  it("admin route rejects an invalid token (401)", async () => {
    const res = await request(app).get("/api/admin/users").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
