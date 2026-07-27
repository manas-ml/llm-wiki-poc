# Response Template

Format the final response as GitHub-flavored markdown. This becomes the body of the PR (or the
`/iterate` comment).

```markdown
## OpenAPI Sync Complete

### Findings (from `npm run check:openapi -- --json`)
| Severity | Kind | Path | Status |
|---|---|---|---|
| high | missing-endpoint | `POST /tasks/{id}/assign` | Fixed |
| medium | schema-drift | `createUserSchema` | Fixed |
| low | param-mismatch | `GET /tasks` (`status`) | Deferred |

### Changes Made
- `openapi.json`: added `POST /tasks/{id}/assign` (operationId `tasks.assign`, requestBody
  `assignTaskSchema`, `200` response, `apiKeyAuth` security)
- `openapi.json`: regenerated `components.schemas.createUserSchema` to match the current Zod
  shape (added `email` as required)

### Deferred
[Only include this section if findings were left unresolved. Name each one and why — e.g.
"low-severity param-mismatch on `GET /tasks` left for a future run to keep this batch small."]

### Validation
- [x] `npm run typecheck` passed
- [x] `npm test` passed
- [x] `npm run check:openapi` reports the deferred findings only (or clean, if none deferred)
```

## Guidelines

1. Lead with the findings table so reviewers immediately see everything the sensor reported,
   not just what changed.
2. "Status" is one of: `Fixed` (openapi.json now matches the code) or `Deferred` (left for a
   future run — batch stayed small on purpose).
3. Keep it scannable — a handful of findings per run, not an exhaustive spec rewrite.
