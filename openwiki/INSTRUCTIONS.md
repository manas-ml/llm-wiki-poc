# OpenWiki instructions for TaskFlow API

This file is read by the OpenWiki documentation agent on every `openwiki code --update`
run. It is user-authored — OpenWiki does not overwrite it. Use it to steer what the
generated wiki emphasizes.

## What this repo is

TaskFlow is a small Express + TypeScript REST API for managing users and tasks. It exists
as a sample project to demonstrate OpenWiki (https://github.com/langchain-ai/openwiki)
against a real, runnable codebase.

## What to prioritize when documenting

- The request lifecycle: `src/app.ts` → route → `*.controller.ts` → `*.service.ts` →
  `*.repository.ts` → `InMemoryStore`. A sequence diagram of one request (e.g. `POST
  /tasks/:id/assign`) is more useful than a file-by-file listing.
- The auth middleware (`src/middleware/auth.middleware.ts`) and error-handling
  middleware (`src/middleware/error.middleware.ts`) — both are cross-cutting and easy
  for new contributors to miss.
- The domain model in `src/types/index.ts` (`User`, `Task`, `TaskStatus`,
  `TaskPriority`) and the invariants enforced in the service layer (unique emails,
  assignee must exist, status transitions).
- The `InMemoryStore` abstraction (`src/db/in-memory-store.ts`) and that it's the single
  seam to swap in a real database later.

## What to skip

- Don't document `node_modules`, build output (`dist/`), or the OpenWiki tool's own
  source under `node_modules/openwiki`.
- Don't restate this INSTRUCTIONS.md file itself in the generated pages.
