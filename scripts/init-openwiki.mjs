// Scaffolds the repo for OpenWiki "code mode" using OpenWiki's own setup
// routine (openwiki/dist/code-mode.js: ensureCodeModeRepoSetup). This is the
// same function the `openwiki code --init` CLI command runs before it hands
// off to the documentation agent, so the generated AGENTS.md, CLAUDE.md, and
// .github/workflows/openwiki-update.yml are real OpenWiki output — not
// hand-written stand-ins.
//
// The next step, generating the actual openwiki/*.md pages, requires an LLM
// call (`openwiki code --update`) and a configured provider API key — see
// README.md.
import { ensureCodeModeRepoSetup } from "openwiki/dist/code-mode.js";

await ensureCodeModeRepoSetup(process.cwd(), {
  createWorkflow: true,
});

console.log("OpenWiki repo scaffolding written: AGENTS.md, CLAUDE.md, .github/workflows/openwiki-update.yml");
