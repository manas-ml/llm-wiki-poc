---
type: Project
title: TaskFlow API — Quickstart
description: TaskFlow is a small Express + TypeScript REST API for managing users and tasks, serving as a proof of concept for OpenWiki. This page is the entry point for the generated wiki.
tags: [quickstart, entrypoint, express, typescript]
---

# TaskFlow API

TaskFlow is a small **Express + TypeScript REST API** for managing users and tasks. It exists as a sample project to demonstrate [OpenWiki](https://github.com/langchain-ai/openwiki) against a real, runnable codebase.

The API is intentionally simple but has enough real structure to be worth documenting: layered modules (routes → controllers → services → repositories), cross-cutting middleware (auth, centralized error handling), Zod input validation, and a couple of actual domain invariants.

## Commands

```sh
npm install
npm run dev          # tsx watch src/server.ts — dev server with reload
npm test             # vitest run — 19 integration tests
npm run typecheck    # tsc --noEmit
npm run build        # tsc -p tsconfig.json -> dist/
npm start            # node dist/server.js (after build)
```

Run a single test file: `npx vitest run test/tasks.test.ts`.

## Quick example

```sh
npm run dev
# in another shell
curl -s http://localhost:3000/health
curl -s -X POST http://localhost:3000/users \
  -H "x-api-key: dev-local-key" -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com"}'
```

Auth is a single shared static API key (`x-api-key` header, checked against `env.API_KEY` from `src/config/env.ts`). There is no per-user auth or session concept.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Health check |
| POST | `/users` | Yes | Create user (`name`, `email`) |
| GET | `/users` | Yes | List all users |
| GET | `/users/:id` | Yes | Get user by ID |
| POST | `/tasks` | Yes | Create task (`title`, `description?`, `priority?`) |
| GET | `/tasks` | Yes | List tasks (filterable by `status?`, `assigneeId?`) |
| GET | `/tasks/:id` | Yes | Get task by ID |
| POST | `/tasks/:id/assign` | Yes | Assign task to a user (`assigneeId`) |
| PATCH | `/tasks/:id/status` | Yes | Update task status (`status`) |

## Architecture

Every request follows the same layering:

```
app.ts -> requireApiKey middleware -> *.routes.ts -> *.controller.ts -> *.service.ts -> *.repository.ts -> InMemoryStore
```

- **Controllers** parse/validate `req.body`/`req.query` with Zod schemas, call the service, and shape the HTTP response. No business logic.
- **Services** hold the actual invariants and throw `AppError(statusCode, message)` for domain failures.
- **Repositories** are the only layer that touches `InMemoryStore`. The store is a generic `Map`-backed collection — the single seam to swap in a real database without touching services or controllers.
- **Cross-module coupling**: `tasks.service.ts` calls `usersService.getUser()` directly to validate an assignee exists before assigning a task — the one place the two modules are coupled.

For the full request lifecycle with a sequence diagram of `POST /tasks/:id/assign`, see [Architecture Overview](/openwiki/architecture/overview.md).

## Domain model

The domain types live in `src/types/index.ts`:

- **`User`** — `{ id, name, email, createdAt }`
- **`Task`** — `{ id, title, description, status, priority, assigneeId, createdAt, updatedAt }`
- **`TaskStatus`** — `"todo" | "in_progress" | "done"`
- **`TaskPriority`** — `"low" | "medium" | "high"`

Key invariants enforced in the service layer (not in the schemas):

- User emails must be unique (`usersService.createUser`, 409 on conflict).
- A task's `assigneeId` must reference an existing user (`tasksService.assignTask`, 404 via `usersService.getUser` if not).
- Task status has no transition restrictions — any status can move to any other.

For the ER diagram and detailed validation schemas, see [Domain Model](/openwiki/domain/model.md).

## Cross-cutting middleware

Two middleware pieces are easy for new contributors to miss:

- **Auth** (`src/middleware/auth.middleware.ts`) — checks the `x-api-key` header against `env.API_KEY`. Applied at router mount level, so only `/health` is public.
- **Error handling** (`src/middleware/error.middleware.ts`) — `AppError` for domain errors (thrown in services), `ZodError` for validation errors (thrown in controllers), and a 500 fallback for anything else. Both are caught centrally by `errorHandler`.

For details on the error response shapes and the `AppError` class, see [Middleware](/openwiki/middleware/middleware.md).

## Testing

The test suite uses `vitest` + `supertest` against the Express app (19 integration tests across `test/app.test.ts`, `test/users.test.ts`, and `test/tasks.test.ts`). `test/setup.ts` sets `process.env.API_KEY = "test-key"` globally. Tests share a single app instance and in-memory state within each file, so ordering matters. `test/app.test.ts` covers app-level behavior (health check, 404 for unknown routes) without auth; the per-module files cover auth rejection, input validation, domain invariants, and filtering.

## Backlog

- **Testing reference page** — `test/app.test.ts` (2 tests), `test/users.test.ts` (6 tests), and `test/tasks.test.ts` (11 tests) are small enough to summarize inline. A dedicated page would add value if the suite grows or unit tests are introduced.
- **OpenWiki integration** — `scripts/init-openwiki.mjs`, `.github/workflows/openwiki-update.yml`, and the CI workflow are documented in the repository README and CLAUDE.md. Not duplicated here because they are tooling, not API domain knowledge.
