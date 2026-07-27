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
  it("rejects requests without an API key", async () => {
    const res = await request(app).get("/tasks");
    expect(res.status).toBe(401);
  });

  it("rejects creating a task without a title", async () => {
    const res = await request(app).post("/tasks").set("x-api-key", API_KEY).send({});
    expect(res.status).toBe(400);
  });

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

  it("rejects assigning a nonexistent task", async () => {
    const user = await createUser("Ada Lovelace", "ada.assign@example.com");

    const res = await request(app)
      .post("/tasks/ghost-task/assign")
      .set("x-api-key", API_KEY)
      .send({ assigneeId: user.id });

    expect(res.status).toBe(404);
  });

  it("rejects assigning a task with an empty assigneeId", async () => {
    const task = await createTask("Needs an owner");

    const res = await request(app)
      .post(`/tasks/${task.id}/assign`)
      .set("x-api-key", API_KEY)
      .send({ assigneeId: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details.fieldErrors.assigneeId).toContain("assigneeId is required");
  });

  it("returns 404 for an unknown task", async () => {
    const res = await request(app).get("/tasks/ghost-task").set("x-api-key", API_KEY);
    expect(res.status).toBe(404);
  });

  it("rejects an invalid status value", async () => {
    const task = await createTask("Fix the flaky test");

    const res = await request(app)
      .patch(`/tasks/${task.id}/status`)
      .set("x-api-key", API_KEY)
      .send({ status: "archived" });

    expect(res.status).toBe(400);
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

  it("returns 404 when updating the status of a nonexistent task", async () => {
    const res = await request(app)
      .patch("/tasks/ghost-task/status")
      .set("x-api-key", API_KEY)
      .send({ status: "done" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Task not found: ghost-task" });
  });

  it("rejects an invalid status filter", async () => {
    const res = await request(app).get("/tasks?status=archived").set("x-api-key", API_KEY);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details.fieldErrors.status).toBeDefined();
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

  it("filters tasks by assignee", async () => {
    const user = await createUser("Margaret Hamilton", "margaret@example.com");
    const assignedTask = await createTask("Write the guidance software");
    await createTask("Unrelated task");

    await request(app)
      .post(`/tasks/${assignedTask.id}/assign`)
      .set("x-api-key", API_KEY)
      .send({ assigneeId: user.id });

    const res = await request(app)
      .get(`/tasks?assigneeId=${user.id}`)
      .set("x-api-key", API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(assignedTask.id);
  });
});
