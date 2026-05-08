import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

// Note: this suite requires opening ephemeral ports, which is blocked in this sandbox.
describe.skip("system routes", () => {
  it("GET /api/health returns ok", async () => {
    const app = createApp();
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("POST /api/ai/suggest returns placeholder", async () => {
    const app = createApp();
    const response = await request(app).post("/api/ai/suggest").send({});
    expect(response.status).toBe(501);
    expect(response.body.mockEnabled).toBe(true);
  });
});
