# Response Template

Format the final response as GitHub-flavored markdown. This becomes the body of the PR (or the
`/iterate` comment).

```markdown
## Test Coverage Expansion Complete

### Gaps Found
| Source | Gap | Status |
|---|---|---|
| `src/modules/tasks/tasks.schemas.ts` | `listTasksQuerySchema` rejects an invalid `status` value | Added |
| `src/modules/tasks/tasks.service.ts` | combined `status` + `assigneeId` filter | Added |
| `src/modules/users/users.service.ts` | [gap found but not closed this run] | Reported (out of scope) |

### Tests Added
- `test/tasks.test.ts`: "rejects an invalid status filter value" — covers `listTasksQuerySchema` enum validation
- `test/tasks.test.ts`: "filters by status and assignee together" — covers combined query filter

### Found But Out Of Scope
[Only include this section if a real src/** bug was found while testing. Describe the bug,
where it lives, and why it wasn't fixed here — this skill only adds tests.]

### Validation
- [x] `npm run typecheck` passed
- [x] `npm test` passed
```

## Guidelines

1. Lead with the gap table so reviewers immediately see scope — every gap considered, not just
   the ones closed.
2. "Status" is one of: `Added` (a test now covers it), `Reported (out of scope)` (a real bug was
   found, not a missing test).
3. Keep it scannable — a handful of gaps per run, not an exhaustive audit.
