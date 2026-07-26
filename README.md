# TaskFlow API — an OpenWiki proof of concept

This repo is a proof of concept for [OpenWiki](https://github.com/langchain-ai/openwiki),
a CLI tool from LangChain that runs a documentation agent ([DeepAgents](https://github.com/langchain-ai/deepagents)
+ [LangChain](https://github.com/langchain-ai/langchainjs)) over a codebase and keeps a
generated wiki — plus `AGENTS.md`/`CLAUDE.md` context files — up to date as the code
changes.

Rather than a toy "hello world," this repo contains a small but real, runnable REST API
(**TaskFlow**, a task-management service) and wires up OpenWiki against it the way a
team would in production: local generation, a checked-in `openwiki/INSTRUCTIONS.md`
brief, and a scheduled CI workflow that opens a PR whenever the docs drift.

## Real-life use case

Engineering teams accumulate architecture knowledge in people's heads faster than in
docs. New hires and AI coding agents both suffer for it: a coding agent given a vague
prompt against an undocumented repo will re-derive (and often mis-derive) how requests
flow through the system every single session. OpenWiki targets that gap directly:

1. **Onboarding** — a generated wiki under `openwiki/` gives new engineers (and AI
   agents) a starting map of the codebase instead of a blank `git clone`.
2. **Living documentation** — the `.github/workflows/openwiki-update.yml` workflow
   (scaffolded by OpenWiki itself, see below) reruns the agent on a schedule and opens a
   PR when the wiki no longer matches the code, instead of docs quietly rotting.
3. **Agent context** — `AGENTS.md` / `CLAUDE.md` point coding agents (Claude Code,
   Cursor, etc.) at the wiki, so every agent session starts with accurate context about
   this specific repo instead of re-exploring it from scratch.

## What's in this repo

```
src/                    TaskFlow API source (Express + TypeScript)
  app.ts                Express app: routes, auth, error handling
  server.ts             Entrypoint
  config/env.ts          Env var validation (zod)
  middleware/            API-key auth + centralized error handling
  modules/users/         Users: routes -> controller -> service -> repository
  modules/tasks/         Tasks: same layering, plus assignment + status transitions
  db/in-memory-store.ts  Swappable in-memory persistence
test/                   vitest + supertest integration tests (19 tests)
openwiki/
  INSTRUCTIONS.md        User-authored brief that steers what OpenWiki documents
scripts/
  init-openwiki.mjs      Scaffolds OpenWiki's repo files (see below)
AGENTS.md, CLAUDE.md     Agent context files (OpenWiki-generated)
.github/workflows/
  openwiki-update.yml    Scheduled OpenWiki doc-update workflow (OpenWiki-generated)
  ci.yml                 Build/typecheck/test for the TaskFlow API itself
```

### Why a real app instead of a stub

OpenWiki's whole value proposition is reading and explaining a codebase. A stub with one
file doesn't exercise that. TaskFlow has enough real structure to be worth documenting:
layered modules (routes/controllers/services/repositories), cross-cutting middleware
(auth, centralized error handling), input validation, and a couple of actual invariants
(unique user emails, task assignment requires an existing user, status transitions) —
the kind of thing an agent has to actually read the code to get right.

Try it yourself:

```sh
npm install
npm run dev
# in another shell
curl -s http://localhost:3000/health
curl -s -X POST http://localhost:3000/users \
  -H "x-api-key: dev-local-key" -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com"}'
```

Run the test suite:

```sh
npm test        # 19 tests, vitest + supertest
npm run typecheck
npm run build
```

## How OpenWiki is wired up here

### 1. Repo scaffolding (already done in this repo)

`openwiki code --init` is an interactive CLI (it's an [ink](https://github.com/vadimdemedes/ink)
TUI) that, among other things, calls an internal function,
`ensureCodeModeRepoSetup`, to write the repo-level files OpenWiki needs:
`AGENTS.md`, `CLAUDE.md`, and `.github/workflows/openwiki-update.yml`.

To make this POC reproducible non-interactively (and to prove the integration is real,
not hand-written), [`scripts/init-openwiki.mjs`](scripts/init-openwiki.mjs) imports and
calls that exact function from the installed `openwiki` package:

```sh
npm run wiki:setup
```

The `AGENTS.md`, `CLAUDE.md`, and `.github/workflows/openwiki-update.yml` in this repo
are the genuine, unmodified output of that call — not hand-written stand-ins.

### 2. Generating the wiki content

Producing the actual wiki pages under `openwiki/` (architecture docs, Mermaid diagrams,
etc.) requires OpenWiki's documentation agent to make LLM calls, which means a
configured provider + API key. This sandbox doesn't have one, so that step is left for
you to run with your own credentials:

```sh
cp .env.example .env
# edit .env: set OPENROUTER_API_KEY
# (defaults to OpenRouter running GLM-5.2 (z-ai/glm-5.2), the same model the
# scheduled workflow uses; see .env.example for Anthropic / OpenAI alternatives)

npm run wiki:update    # openwiki code --update
# or, for the interactive chat/init flow:
npm run wiki           # openwiki code
```

This generates pages such as `openwiki/quickstart.md`, architecture and domain-concept
docs, and Mermaid diagrams of the request flows described in
[`openwiki/INSTRUCTIONS.md`](openwiki/INSTRUCTIONS.md) — e.g. the
`POST /tasks/:id/assign` path through `tasks.controller.ts` → `tasks.service.ts`
(which itself calls `usersService.getUser`) → `tasks.repository.ts`.

### 3. Keeping it in sync via CI

`.github/workflows/openwiki-update.yml` (generated by step 1, unmodified) runs on a
daily cron plus `workflow_dispatch`, re-running `openwiki code --update` and opening a
pull request via [`peter-evans/create-pull-request`](https://github.com/peter-evans/create-pull-request)
whenever the generated docs change. To use it in a real repo, add the referenced secret
(`OPENROUTER_API_KEY` by default — swap the `env:` block for `ANTHROPIC_API_KEY` /
`OPENAI_API_KEY` if you prefer a different provider) under **Settings → Secrets and
variables → Actions**.

This is the "real life" payoff: docs that update themselves as a PR for review, on the
same cadence as your CI, instead of a wiki someone has to remember to edit.

## How the OpenWiki agent actually works

`openwiki code --update` isn't a template renderer — it's a sandboxed [DeepAgents](https://github.com/langchain-ai/deepagentsjs)
agent (a LangGraph-native ReAct harness) run once against the repo. This is grounded in
reading OpenWiki's own installed source (`node_modules/openwiki/dist/agent/*`), not just
its docs:

```
CLI (openwiki code --update)
  └─ resolves provider/model from env (Anthropic / OpenAI / Gemini / Bedrock / OpenRouter…)
  └─ createDeepAgent({ model, tools, backend, middleware, systemPrompt })
        ├─ backend   — virtual filesystem rooted at the repo, write-locked to /openwiki/**
        ├─ tools     — write_todos, ls/glob/grep/read_file/write_file/edit_file, task, execute
        ├─ middleware — OKF front-matter repair + Mermaid validation + index generation
        └─ systemPrompt — the run's actual "spec" (see below)
  └─ agent.streamEvents(...) runs the tool-call loop until it stops
```

**The backend sandboxes the blast radius.** `OpenWikiLocalShellBackend` can `read_file`
anywhere in the repo, but every `write_file`/`edit_file` call is checked against the
target path first — anything outside `/openwiki/` is refused outright
(`agent/docs-only-backend.js`). That's what makes it safe to run unattended in CI.

**The system prompt is the real spec**, not a one-liner — around 400 lines
(`agent/prompt.js`), including:
- *Run discipline* — targeted `grep`/`glob` over entrypoints, routes, and schema files;
  explicitly told not to read every file
- *Subagent discipline* — spawn 1–4 `task` subagents for large/unfamiliar repos to
  research domains in parallel; subagents are read-only, only the main agent writes
- *Planning discipline* — write a temporary `openwiki/_plan.md` with intended pages and
  `source → relationship → target` links before writing final docs, then delete it
- *OKF relationship modeling* — every wiki page is a "concept node"; every Markdown link
  between pages is a typed relationship edge (`depends on`, `dispatches to`, …), so the
  wiki is a knowledge graph, not a folder of files
- *Diagram discipline* — embed a Mermaid `sequenceDiagram`/`stateDiagram-v2`/`erDiagram`/
  `flowchart` wherever a runtime flow, lifecycle, or data model is clearer as a picture

**Deterministic middleware cleans up after the LLM** (`agent/okf-middleware.js`), so the
model doesn't have to be perfect: every write's YAML front matter is validated, with an
actionable warning injected back into the tool result if it's malformed so the agent
self-corrects on its next turn; after the run, every Mermaid fence is parsed and any that
fail to validate are downgraded to plain text instead of breaking the page; and every
directory's `index.md` is regenerated deterministically — the agent is explicitly told
never to write those itself.

**Worked example against this repo.** A real `openwiki code --update` run over TaskFlow
would roughly: `write_todos` a plan (inspect `app.ts`, the `users`/`tasks` modules,
middleware, `openwiki/INSTRUCTIONS.md`, recent git history) → targeted `read_file`/`grep`
discovery (small repo, so no subagents needed) → write `openwiki/_plan.md` mapping
`tasks.service.assignTask -> depends on -> usersService.getUser` and similar relationships
→ write `openwiki/quickstart.md` plus a couple of section pages, including a Mermaid
sequence diagram for `POST /tasks/:id/assign` tracing
`route → controller → service → repository → store` → delete the plan file → hand off to
the deterministic middleware for front-matter/diagram validation and index generation.

It also has a cheap no-op path: before spending an LLM call, the CLI compares the current
git `HEAD` against the last recorded run and skips the agent entirely if nothing changed
(`agent/index.js`, `getUpdateNoopStatus`) — which is what keeps the daily CI cron cheap to
run on quiet days.

## Requirements

- Node.js >= 22 (OpenWiki's own requirement)
- An API key for one supported provider (Anthropic, OpenAI, Gemini, Bedrock, or
  OpenRouter) to actually run `wiki:update` / `wiki`

## Links

- OpenWiki: https://github.com/langchain-ai/openwiki
- DeepAgents (the agent framework OpenWiki is built on): https://github.com/langchain-ai/deepagents
