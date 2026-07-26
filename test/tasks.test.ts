import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const API_KEY = "test-key";
const app = createApp();

async function createUser(name: string, email: string) {
  const res = await request(app).post("/users").set("x-api-key", API_KEY).send({ name, email });
  return res.body as { id: string };
}

async function createTask(title: string) {
  const res = await request(app)
    .post("/tasks")
    .set("x-api-key", API_KEY)
    .send({ title, priority: "high" });
  return res.body as { id: string };
}

describe("tasks API", () => {
  it("creates a task with defaults applied", async () => {
    const res = await request(app)
      .post("/tasks")
      .set("x-api-key", API_KEY)
      .send({ title: "Write the OpenWiki POC" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "Write the OpenWiki POC",
      status: "todo",
      priority: "medium",
      assigneeId: null,
    });
  });

  it("assigns a task to an existing user", async () => {
    const user = await createUser("Linus Torvalds", "linus@example.com");
    const task = await createTask("Review the kernel patch");

    const res = await request(app)
      .post(`/tasks/${task.id}/assign`)
      .set("x-api-key", API_KEY)
      .send({ assigneeId: user.id });

    expect(res.status).toBe(200);
    expect(res.body.assigneeId).toBe(user.id);
  });

  it("rejects assigning a task to a nonexistent user", async () => {
    const task = await createTask("Ship the release");

    const res = await request(app)
      .post(`/tasks/${task.id}/assign`)
      .set("x-api-key", API_KEY)
      .send({ assigneeId: "ghost-user" });

    expect(res.status).toBe(404);
  });

  it("transitions task status", async () => {
    const task = await createTask("Fix the flaky test");

    const res = await request(app)
      .patch(`/tasks/${task.id}/status`)
      .set("x-api-key", API_KEY)
      .send({ status: "in_progress" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_progress");
  });

  it("filters tasks by status", async () => {
    const task = await createTask("Filterable task");
    await request(app)
      .patch(`/tasks/${task.id}/status`)
      .set("x-api-key", API_KEY)
      .send({ status: "done" });

    const res = await request(app)
      .get("/tasks?status=done")
      .set("x-api-key", API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.some((t: { id: string }) => t.id === task.id)).toBe(true);
  });
});
