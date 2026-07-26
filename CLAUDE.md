# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

TaskFlow is a small Express + TypeScript REST API (users + tasks) that serves as a real,
runnable proof of concept for [OpenWiki](https://github.com/langchain-ai/openwiki) — a CLI
tool that runs a documentation agent over a codebase and keeps a generated wiki plus this
file up to date as the code changes. The API itself is intentionally simple; the interesting
part of this repo is the OpenWiki wiring (see below), not the business logic.

## Commands

```sh
npm install
npm run dev          # tsx watch src/server.ts — dev server with reload
npm test              # vitest run — 19 integration tests (test/*.test.ts, supertest against the Express app)
npm run typecheck     # tsc --noEmit
npm run build         # tsc -p tsconfig.json -> dist/
npm start              # node dist/server.js (after build)
```

Run a single test file: `npx vitest run test/tasks.test.ts`.

OpenWiki-specific commands (require a configured provider/API key in `.env`, see
`.env.example`; not needed for API development):

```sh
npm run wiki:setup    # scripts/init-openwiki.mjs — scaffolds AGENTS.md/CLAUDE.md/workflow via openwiki's own ensureCodeModeRepoSetup
npm run wiki:update   # openwiki code --update — regenerates openwiki/ pages
npm run wiki          # openwiki code — interactive chat/init flow
```

## Architecture

Every request follows the same layering, per module:

```
app.ts -> requireApiKey middleware -> *.routes.ts -> *.controller.ts -> *.service.ts -> *.repository.ts -> InMemoryStore
```

- **`src/app.ts`** wires up the two route groups (`/users`, `/tasks`), both gated by
  `requireApiKey`, plus `/health` (unauthenticated) and the terminal `notFoundHandler`/
  `errorHandler` pair.
- **Controllers** (`*.controller.ts`) parse/validate `req.body`/`req.query` with a Zod
  schema from the sibling `*.schemas.ts`, call the service, and shape the HTTP response.
  They hold no business logic.
- **Services** (`*.service.ts`) hold the actual invariants and throw `AppError(statusCode,
  message)` (`src/middleware/error.middleware.ts`) for domain failures — the error
  middleware maps `AppError` and `ZodError` to structured JSON responses, and anything
  else to a 500.
- **Repositories** (`*.repository.ts`) are the only layer that touches
  `src/db/in-memory-store.ts`. `InMemoryStore<T>` is a generic `Map`-backed collection
  (create/findAll/findById/update/delete); it's the single seam to swap in a real database
  without touching services or controllers.
- Cross-module dependency: `tasks.service.ts` calls `usersService.getUser()` directly to
  validate an assignee exists before assigning a task — this is the one place the two
  modules are coupled.

Key invariants enforced in the service layer (not in the schemas):
- User emails must be unique (`usersService.createUser`, 409 on conflict).
- A task's `assigneeId` must reference an existing user (`tasksService.assignTask`, 404
  via `usersService.getUser` if not).
- Task status is a plain enum (`todo` | `in_progress` | `done`) with no transition
  restrictions — any status can move to any other.

Auth is a single shared static API key (`x-api-key` header, checked against `env.API_KEY`
from `src/config/env.ts`), not per-user — there's no session/user-identity concept beyond
the `User` records themselves.

## OpenWiki integration

<!-- OPENWIKI:START -->

## OpenWiki

This repository uses OpenWiki for recurring code documentation. Start with `openwiki/quickstart.md`, then follow its links to architecture, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->

`openwiki/quickstart.md` doesn't exist yet in this checkout — generating it requires
running `npm run wiki:update` with a configured LLM provider (see `.env.example`), which
this environment doesn't have credentials for. `openwiki/INSTRUCTIONS.md` is the
user-authored brief that steers what the agent documents; it's read on every
`--update` run and never overwritten by the tool.

The provider/model is OpenRouter running GLM-5.2 (`OPENWIKI_PROVIDER=openrouter`,
`OPENWIKI_MODEL_ID=z-ai/glm-5.2`), configured identically in `.env.example` (local
`wiki:update`) and `.github/workflows/openwiki-update.yml` (scheduled CI run) so both
paths generate against the same model.

`.github/workflows/openwiki-update.yml` runs `openwiki code --update` on a daily cron and
opens a PR when generated docs drift from the code — this is the mechanism that keeps the
wiki (once generated) in sync, not something to run manually in normal development.
