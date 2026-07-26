import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const API_KEY = "test-key";
const app = createApp();

describe("users API", () => {
  it("rejects requests without an API key", async () => {
    const res = await request(app).get("/users");
    expect(res.status).toBe(401);
  });

  it("creates and retrieves a user", async () => {
    const createRes = await request(app)
      .post("/users")
      .set("x-api-key", API_KEY)
      .send({ name: "Ada Lovelace", email: "ada@example.com" });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com" });

    const getRes = await request(app)
      .get(`/users/${createRes.body.id}`)
      .set("x-api-key", API_KEY);

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(createRes.body.id);
  });

  it("rejects duplicate emails", async () => {
    await request(app)
      .post("/users")
      .set("x-api-key", API_KEY)
      .send({ name: "Grace Hopper", email: "grace@example.com" });

    const dupRes = await request(app)
      .post("/users")
      .set("x-api-key", API_KEY)
      .send({ name: "Grace H.", email: "grace@example.com" });

    expect(dupRes.status).toBe(409);
  });

  it("validates input", async () => {
    const res = await request(app)
      .post("/users")
      .set("x-api-key", API_KEY)
      .send({ name: "", email: "not-an-email" });

    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown users", async () => {
    const res = await request(app)
      .get("/users/does-not-exist")
      .set("x-api-key", API_KEY);

    expect(res.status).toBe(404);
  });
});
