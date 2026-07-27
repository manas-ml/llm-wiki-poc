---
name: openapi-sync
description: fix drift between openapi.json and the live Express routes/Zod schemas in src/modules/**, using the check-openapi-sync.ts sensor's findings as the source of truth rather than eyeballing the spec
---

# OpenAPI Sync

Use this skill when asked to bring `openapi.json` back in sync with the real API surface
implemented in `src/modules/**`.

`openapi.json` documents TaskFlow's routes, request schemas, and auth requirements for
consumers of the API. It drifts silently whenever a route, Zod schema, or status code changes
in `src/modules/**` without a matching edit to the spec. This skill closes that drift in small,
reviewable batches.

## Core Requirements

- Treat the output of `npm run check:openapi` as the source of truth for what's out of sync —
  not a manual read-through of `openapi.json` vs the code.
- Never modify files under `src/**`. This skill only edits `openapi.json` (and, if genuinely
  needed, adds a new top-level section to it — never changes route/schema/behavior code).
- Never run `npm run check:openapi -- --write`. That flag regenerates the whole file from
  scratch and would fix every finding at once, defeating the "small reviewable batch" policy —
  it exists for a human bootstrapping the file, not for this skill.
- Keep each run to a small, reviewable batch: prefer `high` severity findings (missing/extra
  endpoints, missing request schemas) over `medium`/`low` ones (param/auth mismatches, cosmetic
  drift), and stop once you've addressed 3-5 findings rather than clearing the whole list in one
  pass if there are many.
- Match the existing `openapi.json` conventions: `operationId` as `<module>.<handlerName>`
  (e.g. `tasks.assign`), `$ref`-based `requestBody` schemas under `components.schemas`, one
  `parameters` entry per path/query param, `security: [{ apiKeyAuth: [] }]` on every route
  except `GET /health`.

## Workflow

### 1. Run the sensor

```bash
npm run check:openapi -- --json
```

This prints findings sorted by severity (`high` > `medium` > `low`), each naming a `kind`
(`missing-endpoint`, `extra-endpoint`, `schema-drift`, `missing-request-schema`,
`missing-query-param`, `auth-mismatch`, `wrong-status-code`, `param-mismatch`, …), the affected
`path`/`method`, and a human-readable `detail`.

Completion criterion: you have the full, current findings list, not a stale one from a prior
run.

### 2. Pick a reviewable batch

Select 3-5 of the highest-severity findings. If a `high`-severity finding and several
`low`-severity ones both exist, prefer closing the `high` one even if it's alone — correctness
of the documented contract matters more than clearing the count down.

Completion criterion: a named batch of findings for this run, each traceable to a specific
`kind` + `path`/`method` from step 1's output.

### 3. Confirm each finding against the actual code

Before editing `openapi.json`, read the relevant `src/modules/<module>/<module>.routes.ts`,
`*.controller.ts`, and `*.schemas.ts` to confirm what the finding says is really true (the
sensor is static analysis over source text, not a type checker — verify method, path,
request/query schema name, and success status by reading the handler and schema directly).

Completion criterion: for each finding in the batch, you can point to the exact route/schema
code that justifies the edit you're about to make.

### 4. Edit `openapi.json`

- **missing-endpoint**: add the path/method with `operationId`, `parameters` (path params as
  `{ name, in: "path", required: true, schema: { type: "string" } }`), `security` (unless
  `/health`), `requestBody` (if the handler parses `req.body`), and a `responses` entry for the
  real success status code.
- **extra-endpoint**: remove the path/method (or the whole path object if it has no other
  methods left) — the route no longer exists in code.
- **schema-drift / missing-schema**: regenerate that one schema's JSON Schema by hand from the
  Zod definition in `*.schemas.ts` (mirror the shape already used for sibling schemas in
  `openapi.json` — `type`, `properties`, `required`, `enum`, `default`, `minLength`, `format`,
  `additionalProperties: false`) and replace only `components.schemas.<name>`.
- **missing-query-param / missing-path-param / param-mismatch / extra-*-param**: add, remove, or
  correct the single `parameters` entry named in the finding.
- **auth-mismatch**: add or remove `security: [{ apiKeyAuth: [] }]` on that operation.
- **wrong-status-code**: rename the `responses` key to the real status code from
  `res.status(N)` in the controller (default `200` if absent).

Completion criterion: `openapi.json` is valid JSON and every finding in the batch is addressed
by name.

### 5. Validate

```bash
npm run typecheck
npm test
npm run check:openapi
```

The last command must report `openapi.json is in sync with src/modules/**.` — if it still shows
findings you meant to fix, your edit didn't match what step 1 asked for; if it shows *new*
findings, you likely touched something outside the batch.

Completion criterion: all three commands pass, and the only findings left unresolved are ones
you deliberately deferred to a future run (not new ones you introduced).

### 6. Format the response

Read `references/response-template.md` and format your final answer accordingly — this becomes
the PR body.

Completion criterion: the response follows the template and lists every finding from step 1,
which were closed this run, and which were left for a future run.

## Review Checklist

- Every edit traces to a specific finding from `npm run check:openapi -- --json`, confirmed
  against the real route/schema/controller code (not just the finding's `detail` text).
- No file under `src/**` was modified.
- `npm run check:openapi -- --write` was never invoked.
- `npm run typecheck`, `npm test`, and `npm run check:openapi` (no flags) all pass clean.
- `openapi.json`'s existing conventions (operationId naming, `$ref` usage, security placement)
  are preserved, not reinvented.
- The final response follows `references/response-template.md`.
