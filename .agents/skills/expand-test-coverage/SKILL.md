---
name: expand-test-coverage
description: expand vitest+supertest coverage in test/*.test.ts when a route, Zod validation branch, or service-layer invariant in src/modules/** has no corresponding test; use the live route/schema/service code as the source of truth, not the current test count
---

# Expand Test Coverage

Use this skill when asked to find and close gaps in TaskFlow's test suite (`test/*.test.ts`).

The goal is to keep the test suite a faithful, current check of every route, validation branch,
and service invariant in `src/modules/**`, closing gaps in small reviewable batches rather than
rewriting the suite.

## Core Requirements

- Treat `src/modules/**/*.routes.ts`, `*.schemas.ts`, and `*.service.ts` as the source of truth
  for what should be tested — not the existing test count or any notion of "coverage %".
- Never modify files under `src/**`. This skill only adds to or extends files under `test/**`.
- Follow the existing test file conventions (see `test/tasks.test.ts`, `test/users.test.ts`,
  `test/app.test.ts`) instead of introducing a new testing style, mocking approach, or helper
  library.
- Keep the diff to a small, reviewable batch (1-3 gaps) instead of attempting a full-suite
  rewrite in one run.

## Workflow

### 1. Enumerate the source of truth

For each module under `src/modules/` (currently `tasks`, `users`):

- Read `*.routes.ts` to list every HTTP endpoint.
- Read the sibling `*.schemas.ts` to list every Zod validation branch (required fields, enum
  values, `.default(...)` behavior, format checks like `.email()`).
- Read the sibling `*.service.ts` to list every invariant and `AppError` throw, including
  cross-module checks (e.g. `tasksService.assignTask` calling `usersService.getUser`).

Completion criterion: you have a checklist of endpoints, validation branches, and service
invariants across every module in `src/modules/`.

### 2. Diff against existing tests

Read `test/*.test.ts` and, for each checklist item from step 1, decide whether a test already
exercises it — both the happy path and the specific error path (400/401/404/409). A `describe`
block existing for a module does not mean every branch inside it is covered; check the actual
assertions.

Completion criterion: a short list of specific, named gaps, each traceable to a file and
behavior (e.g. "`listTasksQuerySchema` rejects an invalid `status` query value — no test",
"`GET /tasks` with both `status` and `assigneeId` filters combined — no test").

### 3. Pick a reviewable batch

Choose 1-3 of the highest-confidence gaps from step 2 for this run. Prefer gaps that exercise a
real invariant (schema validation, a 404/409 branch, the tasks→users cross-module check) over
cosmetic additions.

If closing a gap would require a behavior change in `src/**` (i.e. you find an actual bug, not
just a missing test), do not fix it. Note it in the final response under "Found But Out Of
Scope" instead — fixing `src/**` bugs is a different workflow's job.

Completion criterion: a named batch of 1-3 gaps, each traceable to a specific file in
`src/modules/**`.

### 4. Write the tests following existing conventions

- Add cases to the matching `describe` block in `test/<module>.test.ts` (create a new file only
  if no matching file exists for the module under test), reusing that file's own `createApp()`
  instance and fixture helpers (e.g. `createUser`, `createTask`) instead of duplicating setup.
- Always authenticate through supertest with the `x-api-key: test-key` header exactly as
  existing tests do. Do not import services directly to bypass HTTP routing and Zod validation —
  that would not test the layer the gap is in.
- Assert on both the HTTP status code and the relevant response body shape, matching the
  specificity of neighboring tests in the same file.

Completion criterion: each new test fails if the gap it targets is reverted (the route/schema/
service change it exercises), and passes against current code.

### 5. Validate

Run:

```bash
npm run typecheck
npm test
```

Completion criterion: both commands pass, and no previously-passing test now fails.

### 6. Format the response

Read `references/response-template.md` and format your final answer accordingly — this becomes
the PR body.

Completion criterion: the response follows the template and lists every gap found, which were
closed, and which (if any) were found but out of scope.

## Review Checklist

- Every new test traces to a specific route, schema branch, or service invariant in
  `src/modules/**`.
- No file under `src/**` was modified.
- New tests reuse the existing file's `createApp()` instance and helper functions.
- `npm run typecheck` and `npm test` both pass.
- Any real bug found while testing (as opposed to a missing test) is reported in the response,
  not silently fixed.
- The final response follows `references/response-template.md`.
