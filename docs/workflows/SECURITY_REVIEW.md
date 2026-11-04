# Security Review

Security review is part of building a change, not a step before a release. This page says which checks a change needs, how to run them, and how to record the result. The rule that requires it is in `CLAUDE.md` (AI Operating Rules, "Review security as part of the change"); the security model it protects is in `docs/philosophy/SECURITY.md`.

---

## The tools

| Tool | What it is | Where it comes from |
|---|---|---|
| `security-audit` | Cloudflare's source-first audit skill: guidance mode for focused questions, full audit mode with six phases and independent verifiers | `security-audit@cloudflare-security`, declared in `.claude/settings.json` through the small marketplace file in `.claude/marketplaces/cloudflare-security/`, pinned to a reviewed commit (MIT, nothing copied) |
| `differential-review` | Reviews a diff or pull request for security regressions | Trail of Bits plugin (CC-BY-SA-4.0, installed from their marketplace, nothing copied) |
| `insecure-defaults` | Finds fail-open configuration, hardcoded secrets, weak defaults | Trail of Bits plugin |
| `sharp-edges` | Finds APIs and settings that are easy to misuse | Trail of Bits plugin |
| `static-analysis` | Runs Semgrep (and CodeQL when installed) and triages the results | Trail of Bits plugin |
| `supply-chain-risk-auditor` | Reviews dependencies for maintenance, ownership and known-vulnerability risk | Trail of Bits plugin |
| `variant-analysis` | After a fix, finds the same bug elsewhere | Trail of Bits plugin |
| `audit-context-building` | Builds a map of the code before a deep audit | Trail of Bits plugin |
| `/security-review` | Claude Code's built-in review of the branch's pending changes | Built in |
| Semgrep | Static analysis CLI (`semgrep --version`) | `pip install semgrep`; jq is needed by the Trail of Bits scripts (`winget install jqlang.jq`) |
| `npm audit` | Known advisories in the dependency tree | npm |

### Setting them up

1. Open the repository in Claude Code and accept the workspace trust prompt; the marketplaces in `.claude/settings.json` only apply after it.
2. Install the plugins once (they stay enabled for this project):

   ```bash
   claude plugin marketplace add ./.claude/marketplaces/cloudflare-security --scope project
   claude plugin install security-audit@cloudflare-security --scope project
   claude plugin install differential-review@trailofbits --scope project
   ```

   Repeat the last line for each `@trailofbits` plugin listed in `enabledPlugins`.
3. Install Semgrep (`pip install semgrep`) and jq. CodeQL is optional.
4. Do not enable `fp-check`, `gh-cli` or `modern-python` at project scope: they install hooks that change every session.

A contributor can switch a plugin off for themselves with `false` in `.claude/settings.local.json`.

---

## Which checks a change needs

| Change | Checks |
|---|---|
| Small: a fix, copy, styling, a field, a test | Name the security effect in one line (often "none"). If it touches input handling, auth, a query, a secret, an external call or HTML output, run `security-audit` in guidance mode on the changed files and Semgrep on them |
| Substantial: a feature, route, service, migration, integration, auth or token flow, background job, dependency | Everything for a small change, plus `insecure-defaults` and `sharp-edges` on the touched area, `supply-chain-risk-auditor` when a dependency changes, a check of every connected caller and permission, and a regression test for each risk found |
| Pull request | `/security-review` or `differential-review` on the diff, Semgrep on the changed files, `npm audit` when the lockfile changed |
| Major: a new platform, a new public endpoint, a change to the security model, or before a major version | A full audit with `security-audit` in full audit mode, Semgrep over the repository, `supply-chain-risk-auditor`, `npm audit`, and a write-up |

A fix gets `variant-analysis` (or a manual search) for the same pattern elsewhere.

### Commands

```bash
# Semgrep on changed files (no telemetry); the registry rule sets need network access
semgrep scan --metrics=off --config p/typescript --config p/javascript --config p/secrets --config p/github-actions $(git diff --name-only main...HEAD)

# the whole repository
semgrep scan --metrics=off --config p/typescript --config p/javascript --config p/secrets --config p/github-actions --exclude node_modules --exclude dist .

# dependency advisories
npm audit --omit=dev
npm audit
```

In Claude Code: `/security-review`, `/differential-review:diff-review <pull request url>`, and the skills by name ("use the security-audit skill in guidance mode on backend/routes/mcpRoutes.ts").

### Rules for running them

- **Never run project code outside a sandbox for an audit.** Claude Code has no sandbox on native Windows, so on Windows the audit reads source only, and a lead that needs running code is recorded as "needs validation" with a plan. Run Claude Code in WSL2 to validate by execution.
- **Never probe production.** No requests to the deployed app or Worker, other people's data, or paid API quota.
- **Keep audit output out of the repository.** The full audit writes to `~/security-audit-skill/twiligent/run-<N>`; Semgrep and other tools write to a temporary folder. `differential-review` runs `git checkout`, so run it in a separate worktree.
- **Never claim a check that did not run.** A write-up names each tool, the command or scope, and its actual result.

---

## Recording the result

- **In the pull request:** a "Security" line with what was checked and found, or why no check was needed.
- **Confirmed vulnerability:** a private GitHub security advisory (Security, Advisories) until the fix is released, never a public issue, because the repository is public. The fix's commit and changelog entry describe the effect in plain words without a recipe.
- **Unresolved risk:** a line in `docs/philosophy/SECURITY.md` (Known risks) or the relevant architecture doc, with the reason it stays and what would remove it.
- **Severity:** critical, high, medium, low or informational, from the impact on a real trust boundary (another user's data, a secret, publishing as someone, running up quota) and how easy it is to reach. A finding is never downgraded to make a report look clean.
