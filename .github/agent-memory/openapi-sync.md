# Agent Memory: OpenAPI Sync

Standing feedback for future `Agent: OpenAPI Sync` runs.

## Guidance

- Never modify files under `src/**`. If closing a finding would require a behavior change
  there, report it as "Found But Out Of Scope" instead of fixing it.
- Never run `npm run check:openapi -- --write`. Fix findings one at a time by hand so diffs
  stay reviewable.
- Keep each PR to 3-5 findings, prioritizing `high` severity (missing/extra endpoints, missing
  request schemas) over `medium`/`low` ones.
