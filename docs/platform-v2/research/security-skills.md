# Security skills research: Cloudflare security-audit and Trail of Bits skills

Research date: 2026-11-05. Read only; nothing was installed and no script, installer or hook from either repository was run.

Clones studied (depth 1):

- `cloudflare/security-audit-skill` at commit `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (2026-09-14)
- `trailofbits/skills` at commit `470419e16f97e112d01fc32f4898aea1755015d9` (2026-11-04). The repository has no git tags.

Local copies were shallow clones in a temporary folder outside the repository.

Claude Code docs checked: code.claude.com `settings`, `settings-reference` (`enabledPlugins`, `extraKnownMarketplaces`), `plugins/org`, `plugins/install`, `plugins/marketplace-reference`, `plugins/manifest-reference`, `workflows`, `sandboxing`. Local Claude Code version: 2.1.296.

---

## 1. Licences

### Cloudflare security-audit-skill: `MIT`

- Copyright (c) 2025-2026 Cloudflare, Inc.
- Referencing or installing it (plugin, `npx skills add --global`, a link in docs): no obligation.
- Copying files into the Twiligent repository (for example `.claude/skills/security-audit/`): keep the copyright line and the MIT permission notice with the copy. The skill folder does not contain the LICENSE file (it sits at the repository root), so a copy needs the notice added, for example a section in `THIRD_PARTY_NOTICES.md` like the existing Intent UI entry. No share-alike; modified copies can stay MIT. Compatible with Twiligent's own MIT licence.

### Trail of Bits skills: `CC-BY-SA-4.0`

- The whole repository, including scripts and workflow `.js` files, is under Creative Commons Attribution-ShareAlike 4.0 International.
- Referencing or installing through the plugin marketplace (files stay in the Claude Code plugin cache, not in the repository): no obligation.
- Copying files verbatim into the repository: attribution required (credit Trail of Bits, link the licence, link the source, say whether changes were made). The copied files stay CC BY-SA 4.0; they cannot be relicensed as MIT.
- Copying and changing them (for example stripping emojis and em dashes to meet project rules, or adapting a skill to the stack): the result is Adapted Material, and ShareAlike requires the adapted files to be licensed CC BY-SA 4.0 (or a BY-SA compatible licence), with attribution and a note of the changes. The rest of the MIT repository is unaffected, but the repository becomes mixed-licence and `THIRD_PARTY_NOTICES.md` must say which files are CC BY-SA.
- The Semgrep skill clones `trailofbits/semgrep-rules` at scan time; those rules are AGPLv3. Using them as scan configuration does not put Twiligent under AGPL; copying them into the repository would.
- Recommendation: reference both repositories (marketplace install), do not vendor. Write Twiligent's own guidance (CLAUDE.md, a short project skill) in the project's words rather than adapting Trail of Bits text.

---

## 2. Structure and skill format

### Cloudflare security-audit-skill

```
LICENSE
README.md
skills/security-audit/
  SKILL.md                                  entry point
  RECONNAISSANCE.md                         phase 1
  HUNTING.md                                phase 2 orchestration and hunter prompt
  ATTACK-CLASSES.md                         core, wildcard and "obvious things" classes
  VALIDATION-AND-REPORTING.md               phases 3 to 6
  WEB-PROTOCOL-AND-AUTH.md                  companion: HTTP, JWT, OAuth/OIDC, sessions, API keys
  CLIENT-SIDE.md                            companion: SPA, DOM, postMessage, CORS, storage
  SUPPLY-CHAIN-AND-RELEASE.md               companion: dependencies, CI, release, signing
  CLOUD-AND-DEPLOYMENT.md                   companion: IAM, serverless, edge workers, config and secrets
  PROTOCOLS-RPC-AND-MESSAGING.md            companion: webhooks, queues, RPC
  RESOURCE-EXHAUSTION-AND-AVAILABILITY.md   companion: quotas, workers, operator spend
  DATA-ISOLATION-AND-LIFECYCLE.md           companion: tenant isolation, row-level policy, caches, export, deletion
  AI-AND-LLM.md, MEMORY-SAFETY-AND-BINARY.md, DESKTOP-MOBILE-AND-LOCAL-IPC.md   companions not relevant here
  report-schema.json                        JSON schema for findings.json
  validate-findings.cjs (+ .test.cjs)       zero-dependency Node validator
  validate-coverage-ledger.cjs (+ .test.cjs) zero-dependency Node validator
```

- One skill. Frontmatter has only `name: security-audit` and `description`. No `allowed-tools`, no agents, no commands, no hooks, no plugin manifest, no `.claude-plugin/marketplace.json`.
- Agent-neutral: it speaks of a "parent", a "Task tool", and two delegated roles (`research`, `general`), which map to Claude Code subagents.
- Only executable parts are the two `.cjs` validators (Node, no dependencies). Node 22 is present, so they run on this machine.

### Trail of Bits skills

```
.claude-plugin/marketplace.json   marketplace "trailofbits", 46 plugins, every source a relative path ./plugins/<name>
plugins/<name>/
  .claude-plugin/plugin.json      name, version, description, author
  skills/<skill>/SKILL.md         frontmatter: name, description, optional allowed-tools (space separated), optional effort
  skills/<skill>/references/      detail files loaded on demand
  skills/<skill>/scripts/         Python (run with uv) and bash helpers
  skills/<skill>/workflows/       prose step guides
  skills/<skill>/agents/openai.yaml  Codex/ChatGPT display metadata (ignored by Claude Code)
  skills/<skill>/assets/trail-of-bits-mark.svg
  agents/*.md                     subagents (frontmatter: name, description, tools list)
  commands/*.md                   slash commands (description, argument-hint, allowed-tools)
  workflows/*.js                  Claude Code dynamic workflows, run as /<plugin>:<meta.name>
  hooks/hooks.json                event hooks (only fp-check, gh-cli, modern-python)
  evals/, tests/                  maintainers' test suites
AGENTS.md, CLAUDE.md (@AGENTS.md), Makefile, ruff.toml, .pre-commit-config.yaml
```

- Dynamic workflows (`workflows/*.js`) need the Claude Code Workflow tool. Docs: available on all paid plans and the API; on Pro it must be turned on in `/config`. Plugins that depend on it: `insecure-defaults` (command calls the workflow), `audit-context-building`, `variant-analysis` (`/variant-analysis:variants`), `static-analysis` (`/static-analysis:semgrep-scan`, `/static-analysis:codeql-build`), `spec-to-code-compliance`, `post-patch-validation`, `c-review`, `code-improver`, `git-cleanup`, `semgrep-rule-variant-creator`.
- Hooks that install with a plugin:
  - `fp-check`: `Stop` and `SubagentStop` prompt hooks that run on every stop of every session while the plugin is enabled (an extra model call each time; it answers `ok` when the session is not an fp-check session, but still costs a call).
  - `gh-cli`: `SessionStart` bash scripts that install a PATH shim for `gh`, `PreToolUse` hooks on every `Bash`, `WebFetch` and MCP fetch call, and a `SessionEnd` cleanup. It changes how every session behaves.
  - `modern-python`: hooks, not relevant to this stack.
  - Recommendation: do not enable these three at project scope.

---

## 3. Installing in Claude Code

### Trail of Bits: a real plugin marketplace

Commands inside a session:

```
/plugin marketplace add trailofbits/skills
/plugin install differential-review@trailofbits
/plugin install static-analysis@trailofbits
```

From a shell (scope flag supported):

```
claude plugin marketplace add trailofbits/skills
claude plugin install differential-review@trailofbits --scope project
```

- Marketplace name is `trailofbits` (from `marketplace.json`), so plugin ids are `<plugin>@trailofbits`.
- Pinning: a GitHub marketplace source takes `ref` (branch or tag) but not `sha`. The repository has no tags, so the only pins are `main` or a fork you control (for example fork to `spacesdrive/trailofbits-skills` and pin a tag there). Third-party marketplaces default to `autoUpdate: false`, so installed plugins stay at the installed version until someone runs `/plugin marketplace update`.

### Cloudflare: no marketplace

The supported method in its README is the Skills CLI:

```
npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit           (project install, copies files into the repo)
npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit --global  (user install, outside the repo)
```

The project install copies MIT files containing em dashes into the repository (see section 7) and needs a notice entry. The global install avoids both but is per person.

Alternative that keeps it out of the repository and shared through settings: declare an inline `settings` marketplace whose one plugin points at the Cloudflare repository pinned to a commit. Per the manifest reference the plugin manifest is optional, and without one Claude Code loads the standard layout, which includes `skills/` at the plugin root, which is exactly where this repository keeps `skills/security-audit/`. This follows the documented rules but was not tested here. The skill would show as `security-audit:security-audit`.

### Project settings so every contributor gets them

Keys confirmed in the settings reference: `extraKnownMarketplaces` (object: marketplace name to `{ source, autoUpdate? }`) and `enabledPlugins` (object: `plugin@marketplace` to boolean). Both may be set in the shared `.claude/settings.json`.

```json
{
  "extraKnownMarketplaces": {
    "trailofbits": {
      "source": { "source": "github", "repo": "trailofbits/skills", "ref": "main" }
    },
    "cloudflare-security": {
      "source": {
        "source": "settings",
        "name": "cloudflare-security",
        "plugins": [
          {
            "name": "security-audit",
            "source": {
              "source": "github",
              "repo": "cloudflare/security-audit-skill",
              "sha": "c1c8a8c1471069fb0e188eeaff69b8e8db6564a8"
            }
          }
        ]
      }
    }
  },
  "enabledPlugins": {
    "differential-review@trailofbits": true,
    "insecure-defaults@trailofbits": true,
    "sharp-edges@trailofbits": true,
    "static-analysis@trailofbits": true,
    "supply-chain-risk-auditor@trailofbits": true,
    "variant-analysis@trailofbits": true,
    "audit-context-building@trailofbits": true,
    "security-audit@cloudflare-security": true
  }
}
```

How it behaves (from `plugins/org` and the settings reference):

- `extraKnownMarketplaces` from a repository file applies only after the contributor accepts the workspace trust dialog for the folder. In an untrusted folder, and in `-p` runs in a folder never trusted interactively, it is ignored silently.
- Trail of Bits plugins are listed by relative path, so once the marketplace is registered they load from the marketplace copy with no extra step.
- The Cloudflare entry points at an external GitHub source, so `enabledPlugins` alone does not install it: each contributor sees "enabled in project settings but isn't installed" until they run once:
  `claude plugin install security-audit@cloudflare-security --scope project`
- A contributor can opt out locally by setting a plugin to `false` in `.claude/settings.local.json`.
- Optional but useful: `autoUpdate` stays off (the default for third-party marketplaces) so a skill does not change under the team without a reviewed bump.

---

## 4. Cloudflare security-audit: how it works

### Modes

- Guidance mode (default): for questions, focused reviews, triage of one finding. Uses only relevant parts, writes no files, may launch focused agents.
- Full audit mode: only when explicitly asked to audit or pen-test the codebase, for a full or end-to-end review, or when report artifacts are requested. If the request is ambiguous it must ask one question first.

### Execution rules (both modes)

- Source review is read-only. Target-controlled builds, tests or processes may run only inside an OS-enforced sandbox with no network, an empty allowlisted environment, read-only target and toolchain, scratch-only writes and resource limits. If any control is missing it does not execute and keeps the lead as `needs_validation`.
- No probing of deployed endpoints, providers, shared services, production identities or paid APIs. No installing or fetching dependencies.
- Consequence here: Claude Code's sandbox runs on macOS, Linux and WSL2 only; on native Windows commands run unsandboxed. So on this machine the skill will be source-only, and leads that need execution end as `needs_validation`. Running Claude Code inside WSL2 with `/sandbox` would allow bounded local checks.

### Full audit setup

- Resolves skill dir, target, repo name, source ref (commit and dirty state) and an output directory outside the target, default `~/security-audit-skill/<repo-name>/run-<N>`. Inside the repo only if the user picks a git-ignored directory.
- Writes `run-metadata.json` first. Only the parent writes shared files; each subagent gets `agents/<id>/scratch/` and a parent-owned `artifacts/`.
- Profiles: `quick` (coarse ledger, one hunter wave, one critic, one verifier per candidate), `standard` (default), `deep` (per subsystem and lifecycle, critic waves to a clean pass, separate verifiers). Scoped runs cover named paths, a subsystem or the diff between two refs; everything else is `out_of_scope`. Optional budget measured in agent invocations, with reserves for critics and verifiers.
- Repeat runs are additive: prior `coverage-ledger.json` and `findings.json` are read and drive the next run.

### Six phases

1. Reconnaissance: four parallel `research` agents map (1a) product, stack, entry points and offline build/test commands; (1b) principals, authentication, authorization, tenant scope, privilege changes; (1c) every entry surface, transformation and sink; (1d) local test fixtures, prohibited commands, deployment facts source cannot establish, and whether sandbox controls exist. Parent writes `architecture.md` (about 1,000 words max) and seeds `coverage-ledger.json`: one unit per surface x trust boundary x subsystem x attack class, with stable percent-encoded `coverage_id`s. Runs `validate-coverage-ledger.cjs` after every ledger change.
2. Coverage-led hunting: `general` hunter agents take ledger units in priority order (unauthenticated surfaces first, most valuable resources next, then prior gaps). Each hunter gets `architecture.md`, its units, the exact attack-class blocks copied verbatim, exclusions, the hunting method and validation rules, and must return one JSON object. Coverage-critic agents look for gaps between waves.
3. Candidate validation: every unique candidate goes to a fresh verifier that did not find it and tries to refute it. Returns `confirmed`, `needs_validation` or `rejected`.
4. Structured output: `findings.json` written against `report-schema.json`, checked with `validate-findings.cjs` and the ledger validator.
5. Independent record verification: a fresh agent per final record re-checks every path, line, condition, severity and fix. Material changes go to yet another fresh verifier.
6. Reporting: `REPORT.md`, `FINDINGS-DETAIL.md` (medium and above), `NEEDS-VALIDATION.md`.

### What it checks

- Core classes in `ATTACK-CLASSES.md`: injection (including second-order and into logs or caches), access control (authentication without authorization, field overrides, batch and export paths), resource and file handling (path traversal, SSRF, deserialization, TOCTOU), cryptography and secrets (weak randomness, hardcoded secrets, missing HMAC checks, timing-unsafe comparison, fail-open crypto errors), business logic (state machines, races, time windows, defaults when config is missing), feature abuse and data leakage (export, import, search as oracle, enumeration, webhook SSRF), chained trust-boundary failures, a wildcard hunter, and an "obvious things" checklist (secrets in source, security TODOs, debug gates, open endpoints, committed `.env`, pinned dependencies and CVEs, `eval`, permissive CORS, cookie flags, open redirects, stack traces in errors).
- Companions that match Twiligent: WEB-PROTOCOL-AND-AUTH (JWT checks: signature, pinned algorithm, `exp`/`nbf`/`aud`/`iss`; OAuth state, PKCE, redirect_uri; API keys in bundles), CLIENT-SIDE (React SPA), CLOUD-AND-DEPLOYMENT (edge worker identity, config and secret lifecycle, edge vs origin mismatches, provider events trusted without signed envelopes), DATA-ISOLATION-AND-LIFECYCLE (row-level policy vs bypass clients: directly relevant to RLS plus a service-key backend), PROTOCOLS-RPC-AND-MESSAGING (Instagram webhooks), RESOURCE-EXHAUSTION-AND-AVAILABILITY (rate limits, operator API spend), SUPPLY-CHAIN-AND-RELEASE (GitHub Actions, dependencies).

### Tools it runs

None beyond the two Node validators. Everything else is the agent reading source, plus bounded sandboxed local checks when a sandbox exists.

### Report format and severity

- Verdicts: `confirmed` (complete source trace and bounded observed result), `needs_validation` (exact unresolved blocker, a local or owner-observed validation plan, no severity), `rejected` (kept so later runs do not repeat it).
- Severity only on `confirmed`: likelihood, impact and overall, each one of `informational`, `low`, `medium`, `high`, `critical`; overall may not exceed impact. Confidence `low`, `medium`, `high`. Anchors: critical = unauthenticated code execution, full data-store access or arbitrary account takeover; high = full defeat of an explicit control (auth bypass, cross-tenant read or write, stored XSS on others, authenticated RCE); medium = real boundary violation with limited blast radius; low = non-secret internals or high-effort minimal gain; informational = minimal impact.
- `REPORT.md`: run profile, scope, budget, source ref, coverage statement (partial runs must say so); posture summary; confirmed findings table; per finding: location, lower-trust principal, bounded reproduction, conditions, result, impact, priority rationale, smallest fix; a separate NEEDS VALIDATION table; hardening notes and positive patterns; ledger coverage counts.

### Remediation guidance

For each confirmed finding: name the invariant the code must enforce and the narrowest source change at the last trusted decision point, with repository-relative changes and a regression test. It describes fixes; it never edits the target. Defense-in-depth gaps where another layer already blocks the attack are hardening notes, not findings.

---

## 5. Trail of Bits: every plugin (46)

| Plugin | One line |
| --- | --- |
| agentic-actions-auditor | Audits GitHub Actions workflows that run AI agents (Claude Code Action, Codex, Gemini CLI) for prompt-injection paths |
| audit-context-building | Builds a function-by-function understanding dossier before bug hunting (dynamic workflow) |
| building-secure-contracts | Smart-contract scanners for six blockchains and guideline assistants |
| burpsuite-project-parser | Searches Burp Suite `.burp` project files |
| c-review | C/C++ security review with parse-verified coverage |
| chrome-mcp-troubleshooting | Fixes Claude in Chrome MCP connectivity |
| code-improver | Autonomous review-and-fix loop with a pluggable reviewer |
| constant-time-analysis | Compiler-induced timing side channels in crypto code |
| culture-index | Interprets Culture Index survey results |
| devcontainer-setup | Creates devcontainers with Claude Code and language tooling |
| differential-review | Security review of a PR, commit or diff with git history and blast radius |
| dimensional-analysis | Unit and decimal-scaling bug audit with unit annotations |
| dwarf-expert | DWARF debug info analysis |
| entry-point-analyzer | State-changing entry points in smart contracts |
| firebase-apk-scanner | Firebase misconfigurations in Android APKs |
| fp-check | Verifies a suspected bug as true or false positive with gated phases (installs Stop hooks) |
| gh-cli | Redirects GitHub fetches to `gh` (installs PATH shim and Bash/WebFetch hooks) |
| git-cleanup | Safe cleanup of local branches and worktrees |
| github-triage | Triage and merge of open issues and PRs via `gh` |
| goal-prompt | Drafts `/goal` commands |
| insecure-defaults | Fail-open defaults, fallback secrets, default credentials, weak crypto, permissive access, debug leakage |
| let-fate-decide | Tarot draw for vague planning |
| modern-cpp | Modern C++ practices |
| modern-python | Modern Python tooling (has hooks) |
| mutation-testing | mewt/muton mutation campaigns and survivor triage |
| open-sourcing | Prepares a repository for public release: secret history, licence, CI readiness |
| patching-bugs | Reproduce, patch and prove one known bug |
| post-patch-validation | Checks a security patch for missed variants and regressions |
| property-based-testing | Writes and reviews property tests (Hypothesis, fast-check, proptest) |
| regression-hunt | Finds and replays regressions across PRs and commits |
| review-walkthrough | Interactive HTML walkthrough of branch changes |
| rust-review | Rust security review |
| second-opinion | Independent review from Codex or Antigravity CLIs |
| semgrep-rule-creator | Writes and tests custom Semgrep rules |
| semgrep-rule-variant-creator | Ports Semgrep rules to other languages |
| sharp-edges | Footgun APIs, dangerous configuration, insecure-by-default designs |
| spec-to-code-compliance | Checks code against the documentation that specifies it |
| static-analysis | Semgrep, CodeQL and SARIF parsing skills plus scan workflows |
| supply-chain-risk-auditor | npm/PyPI/Go dependency advisories, abandonment, publisher concentration, install scripts |
| testing-handbook-skills | Testing Handbook skills: fuzzers, sanitizers, coverage, Wycheproof |
| trailmark | Code graphs, context slicing, diagrams, mutation triage, protocol modelling |
| variant-analysis | Finds other instances of a known bug, generalizes to Semgrep/CodeQL |
| vulnerability-triage-brocards | Triage of incoming vulnerability reports with seven rules of thumb |
| writing-lean-proofs | Lean 4 proofs |
| yara-authoring | YARA-X rule authoring |
| zeroize-audit | Missing zeroization of secrets in C/C++ and Rust |

### Relevant to Twiligent: workflow, tools, Windows status

Windows facts used below: Git Bash present; Node 22.18.0; Python 3.12.9; pip 26.2.1; uv 0.12.5; gh logged in as spacesdrive; Docker 29.6.2; semgrep 1.174.0 installed (pip, Python 3.12); codeql, osv-scanner, gitleaks and jq not installed.

**differential-review** (plugin `differential-review`, command `/differential-review:diff-review <pr-url|commit-sha|diff-path> [--baseline <ref>]`, agent `differential-review:adversarial-modeler`)
- Workflow: pre-analysis baseline (optionally via audit-context-building), Phase 0 triage (diff stats, size class SMALL/MEDIUM/LARGE, risk per file HIGH/MEDIUM/LOW), Phase 1 changed-code analysis with `git blame` on removed code, Phase 2 test coverage of changed code, Phase 3 blast radius by counting callers, Phase 4 deep context on HIGH files, Phase 5 adversarial modelling, Phase 6 markdown report with CRITICAL/HIGH/MEDIUM/LOW counts and APPROVE/REJECT/CONDITIONAL.
- Tools: git, gh. Works on Windows.
- Caveats: methodology says `git checkout <baseline_commit>` (mutates the working tree; use a worktree instead); the report defaults to the current working directory (the repo) as `<PROJECT>_DIFFERENTIAL_REVIEW_<DATE>.md`; templates are smart-contract flavoured and use emojis.

**insecure-defaults** (command `/insecure-defaults:audit [path]`, workflow `audit-pipeline`)
- Workflow: Recon (Sonnet) profiles stack and deploy manifests and finds config wrappers; Discover (6 Sonnet sweeps in parallel, one per category: fallback secrets, default credentials, fail-open switches, weak crypto, permissive access, debug leakage) using grep seeds plus stack-derived patterns; Verify (Opus refuting agents, up to 16 candidates each, start at refuted and stop at the first kill step: reachable in prod, value actually used, actually insecure, reaches a security decision, does deployment always set the variable); Report (severity CRITICAL to LOW, remediation, coverage gaps).
- Tools: none external (grep). Needs dynamic workflows. Works on Windows.
- Good fit: Worker env bindings (`c.env.X ?? 'default'`), CORS config, fallback secrets in `wrangler.toml`/`.dev.vars` templates, debug error output.

**sharp-edges** (skill and agent `sharp-edges-analyzer`, tools Read Grep Glob only)
- Workflow: surface identification, edge-case probing (zero, empty, null), threat modelling, validation. Categories include algorithm selection (JWT `alg`), dangerous defaults, primitive vs semantic APIs, timing-unsafe comparison, configuration footguns. Has `lang-javascript.md`.
- Tools: none. Works on Windows. Useful for `backend/lib/` helpers, rate-limit config, webhook signature checks, JWT verification code.

**static-analysis** (skills `semgrep`, `codeql`, `sarif-parsing`; workflows `/static-analysis:semgrep-scan {"target":"/abs/path","mode":"run-all"}` and `/static-analysis:codeql-build`)
- Semgrep workflow: detect languages and Pro; pick mode (run all, or important only = WARNING/ERROR plus security category with medium/high confidence and impact); select rulesets (baseline `p/security-audit`, `p/secrets`; TS gets `p/typescript`, `p/react`, `p/nodejs`; YAML gets `p/github-actions`; third-party `trailofbits/semgrep-rules`); hard approval gate; `scripts/run-scans.sh` runs everything with `--metrics=off`; `merge_sarif.py` (via uv) merges to `results/results.sarif`; report includes failed and skipped scans.
- Semgrep tools: semgrep, bash, jq, git, uv. On Windows: semgrep CLI has native Windows support (public beta July 2025, announced GA autumn 2025; PyPI ships a win_amd64 wheel, latest 1.183.0) and 1.174.0 already runs here. jq is missing and `run-scans.sh` exits without it (install with `winget install jqlang.jq`). The script targets bash 3.2+, so Git Bash should work, but Trail of Bits does not test on Windows. Semgrep Pro (cross-file taint) needs a Semgrep login and licence; OSS works without.
- Default output directory is `./static_analysis_semgrep_N` in the current directory, which would land in the repo; pass an output directory outside it.
- CodeQL workflow: build database (JS/TS needs no build), data extensions for project wrappers (for example the repository layer around Supabase), run an explicit `.qls` suite (security-and-quality plus security-experimental, or high-precision only), quality checks so zero findings are not taken as clean.
- CodeQL tools: codeql CLI, jq, uv, bash. CodeQL CLI is published for Windows x64 (`codeql-bundle-win64`, or `gh extension install github/gh-codeql`), not installed here. Practical alternative: GitHub code scanning with CodeQL in CI, free for public repositories such as Twiligent.

**supply-chain-risk-auditor**
- Workflow: confirm manifests; check `gh auth status`; `uv run collect.py <project> --json <out>/findings.json`, then `uv run render.py ... --out <out>/report.md`; the agent adds upgrade paths, replacements and whether `npm ci --ignore-scripts` is viable. Criteria: version-matched OSV advisories for direct deps and the full `package-lock.json` tree, archived or abandoned upstreams, npm publisher concentration, install scripts, OpenSSF Scorecard.
- Tools: Python 3.11+ stdlib, uv, network access to OSV, npm, deps.dev, GitHub, Scorecard APIs; gh token recommended. osv-scanner and pip-audit are optional cross-checks only. All present except osv-scanner; works on Windows.
- Monorepo caveat: direct-dependency criteria read only the `package.json` in the target directory. Twiligent's root has the shared dev tooling, while `hono`, `@supabase/supabase-js`, React and so on are declared in `backend/`, `frontend/` and `site/`. The transitive advisory sweep of the root `package-lock.json` still covers everything. For full direct-dependency coverage run it on each workspace too (without a lockfile there, versions fall back to latest release).

**variant-analysis** (skill, workflow `/variant-analysis:variants`)
- Workflow: root cause, exact-match pattern, generalize one element at a time, triage with severity, report with a CI rule. Ships `resources/semgrep/javascript.yaml` and `resources/codeql/javascript.ql` starters.
- Tools: grep at minimum; semgrep or codeql for structural search. Works on Windows with the installed semgrep.
- Twiligent use: after any finding, for example one user-scoped query missing `.eq('user_id', userId)`, find all others.

**semgrep-rule-creator**
- Writes and tests custom Semgrep rules. Tools: semgrep. Works here.
- Twiligent use: encode project invariants as CI rules, such as `fetch(` outside `frontend/src/services/api.ts`, Supabase queries outside `backend/repositories/`, `...ForUser` methods without a `user_id` filter, `SUPABASE_SERVICE_KEY` referenced outside the backend.

**audit-context-building** (workflow `/audit-context-building:audit-context <path>`, agent `function-analyzer`)
- Builds `audit-context/DOSSIER.md` and one file per function: invariants, assumptions and what establishes them, cross-function rules. No verdicts. Writes into `audit-context/` under the current directory. Needs dynamic workflows; no external tools. Optional pre-step for a full audit; expensive on a whole monorepo.

**agentic-actions-auditor**
- Static audit of GitHub Actions workflows that call AI agents: env var intermediaries, direct `${{ }}` injection, `pull_request_target` checkout, dangerous sandbox settings, wildcard allowlists. Tools: Read/Grep, optional gh. Works on Windows.
- Twiligent today: none of `ci.yml`, `deploy-*.yml`, `publish-scheduled.yml` invoke an AI action, so it is relevant only if Claude Code Action is added later. General Actions hardening is covered by Semgrep `p/github-actions` and the Cloudflare SUPPLY-CHAIN companion.

**property-based-testing**
- Picks a property (roundtrip, idempotence, invariant, oracle) and writes fast-check tests for TS. Relevant to pure `lib/` helpers (rate-limit algorithms, scheduling rules in `scheduledPublishing.ts`, metric math). Requires adding `fast-check` as a dev dependency, which the project's "no dependencies without approval" rule gates. Tests would use `node:test`, matching the project.

**fp-check**
- Rigorous true/false-positive verification of a single suspected bug, with gate reviews and PoCs. Useful conceptually, but its Stop and SubagentStop prompt hooks fire in every session while enabled. Prefer enabling it only per person when needed. The Cloudflare skill's independent verifiers already cover this role in full audits.

**spec-to-code-compliance** (optional)
- Checks code against the documents that specify it, one agent per requirement. Twiligent's `docs/architecture/database/SECURITY.md`, `REQUEST_PIPELINE.md` and `AUTOMATION.md` state security invariants that this could check. Needs dynamic workflows.

**post-patch-validation** (optional): after fixing a security bug, looks for missed variants and regressions. Python script via uv plus a workflow.

**open-sourcing** (optional): secret-history hygiene for a public repository. The repo is already public; gitleaks over history is the more direct check.

Not relevant: building-secure-contracts, entry-point-analyzer, c-review, rust-review, constant-time-analysis, zeroize-audit, dwarf-expert, firebase-apk-scanner, burpsuite-project-parser, yara-authoring, modern-cpp, modern-python, writing-lean-proofs, dimensional-analysis, culture-index, let-fate-decide, chrome-mcp-troubleshooting, gh-cli, git-cleanup, github-triage, goal-prompt, devcontainer-setup, review-walkthrough, second-opinion (needs Codex or Antigravity CLIs), mutation-testing (mewt supports `javascript/ts` but is not installed and is a heavier tool), trailmark, testing-handbook-skills (fuzzers and sanitizers for native code; Wycheproof only if crypto code is written), regression-hunt, code-improver, patching-bugs, vulnerability-triage-brocards (only if outside reports arrive), semgrep-rule-variant-creator.

---

## 6. Which skills for which job

### (a) Full security audit of the app

1. Cloudflare `security-audit`, full audit mode, `standard` profile (or `deep` for auth, webhooks and RLS), output directory outside the repo. Companions to expect: WEB-PROTOCOL-AND-AUTH, CLIENT-SIDE, CLOUD-AND-DEPLOYMENT, DATA-ISOLATION-AND-LIFECYCLE, PROTOCOLS-RPC-AND-MESSAGING, RESOURCE-EXHAUSTION-AND-AVAILABILITY, SUPPLY-CHAIN-AND-RELEASE. On native Windows it stays source-only.
2. `static-analysis` Semgrep scan (run all) with TS, React, Node, GitHub Actions and Trail of Bits rules; optionally CodeQL (locally once installed, or GitHub code scanning in CI).
3. `supply-chain-risk-auditor` on the root (lockfile sweep) and on each workspace.
4. `insecure-defaults` on the whole repo.
5. `sharp-edges` on `backend/lib/`, `backend/middleware/`, auth and webhook code.
6. Optional: `audit-context-building` first on `backend/`; `spec-to-code-compliance` against the security docs; `variant-analysis` for each confirmed finding; a secret scan of git history with gitleaks.

### (b) Targeted checks on a small change

- Cloudflare `security-audit` in guidance mode on the touched files (no artifacts written).
- `insecure-defaults` scoped to the changed path when config, env or defaults change.
- `sharp-edges` when a new API, option or config surface is added.
- Semgrep on the changed files (skill, or a direct `semgrep --metrics=off --config p/typescript --config p/secrets <files>`).
- `supply-chain-risk-auditor` when a dependency is added or bumped.
- `variant-analysis` when the change fixes a bug.
- `property-based-testing` for new pure helpers (subject to dependency approval).

### (c) Reviewing a pull request diff

- `differential-review` via `/differential-review:diff-review <pr-url>` with the report written outside the repo.
- Cloudflare `security-audit` as a scoped run over the diff between the base and head refs, `quick` profile, for PRs that touch auth, webhooks, repositories, migrations or CI.
- Semgrep on the changed files (or a baseline diff scan).
- `agentic-actions-auditor` if the PR adds or changes an AI agent step in `.github/workflows/`.
- Claude Code's built-in `/security-review` command is also available for a quick pass on pending changes.

---

## 7. Conflicts with project rules

| Rule | Where the skills conflict | Effect and handling |
| --- | --- | --- |
| No emojis | differential-review `reporting.md`: severity emojis in the summary table and headings, status emojis, and a notification template with emojis; semgrep `SKILL.md` and `workflows/scan-workflow.md` use a stop-sign symbol in instructions; sharp-edges `lang-swift.md` has an emoji in a code example | The differential-review report and its chat summary will contain emojis unless told otherwise. Add a project instruction: write reports in plain text, severity as words. Do not vendor these files |
| No em dashes or en dashes | Counted em dashes: Cloudflare repo 36 (plus 2 en dashes), static-analysis 333, variant-analysis 155, property-based-testing 141, fp-check 111, supply-chain-risk-auditor 103, audit-context-building 90, sharp-edges 22, differential-review 9, insecure-defaults 2, agentic-actions-auditor 0 | Harmless while the files live in the plugin cache. Vendoring any of them (including `npx skills add` project install) puts em dashes into the repository. Generated reports may imitate the style; instruct plain hyphens |
| No AI attribution in commits | No skill read here adds Co-Authored-By or "Generated with" lines. The Trail of Bits README invites "Found using Trail of Bits Skills" in bug reports (optional, not a licence requirement for use) | No conflict. Claude Code's own commit attribution is a separate harness setting the project already overrides |
| Reports and files inside the repo | Semgrep and CodeQL default to `./static_analysis_*_N`, differential-review to the current directory, audit-context-building to `audit-context/` | Always pass an output directory outside the repo (or add these names to `.gitignore`). Cloudflare already defaults outside the target |
| Do not disturb the working tree | differential-review methodology runs `git checkout <baseline_commit>` | Tell it to use `git worktree add` or `git show <ref>:<path>` |
| No new dependencies without approval | property-based-testing needs `fast-check`; nothing else adds project dependencies (tools install on the machine, not in `package.json`) | Ask before adding fast-check |
| Every task has a GitHub issue; the repository is public; no secrets in issues | Audit reports contain exploit paths | Track the audit task in an issue, but keep vulnerability details out of public issues; use GitHub private security advisories for confirmed findings |
| Hooks and behaviour changes | fp-check Stop/SubagentStop hooks; gh-cli PATH shim and Bash/WebFetch hooks | Do not enable at project scope |

---

## 8. Tools on this machine

| Command | Result |
| --- | --- |
| `semgrep --version` | 1.174.0 (pip, Python 3.12 Scripts folder; prints that a newer version exists; PyPI latest 1.183.0) |
| `codeql version` | not found |
| `osv-scanner --version` | not found |
| `gitleaks version` | not found |
| `python --version` | Python 3.12.9 (`python3` is the Microsoft Store alias and does not work; `py` works) |
| `pip --version` | pip 26.2.1 (Python 3.12) |
| also checked | uv 0.12.5, node v22.18.0, git (Git for Windows), gh (logged in as spacesdrive), Docker 29.6.2, Claude Code 2.1.296; jq not found; pipx not found |

What each relevant skill needs and whether it is ready:

| Skill | Needs | Ready on this machine |
| --- | --- | --- |
| Cloudflare security-audit | Node for validators; subagents; a sandbox for local execution | Yes for source-only audits; no sandbox on native Windows (WSL2 would add one) |
| differential-review | git, gh | Yes |
| insecure-defaults | dynamic workflows (Workflow tool) | Yes if the plan has workflows enabled |
| sharp-edges | nothing | Yes |
| static-analysis: semgrep | semgrep, jq, uv, git, bash | No until jq is installed (`winget install jqlang.jq`) |
| static-analysis: codeql | codeql CLI, jq, uv, bash | No (CodeQL CLI Windows x64 bundle or `gh extension install github/gh-codeql`, plus jq) |
| supply-chain-risk-auditor | uv, Python 3.11+, network, gh token | Yes |
| variant-analysis | grep; semgrep or codeql optional; workflows for `/variants` | Yes with semgrep |
| semgrep-rule-creator | semgrep | Yes |
| audit-context-building, spec-to-code-compliance | dynamic workflows | Yes if workflows enabled |
| agentic-actions-auditor | gh optional | Yes |
| property-based-testing | fast-check dev dependency | Needs approval |
| secret history scan (not a skill) | gitleaks | No (Windows x64 release binaries exist; Semgrep `p/secrets` and `p/gitleaks` are a partial substitute) |
| osv-scanner (optional cross-check) | osv-scanner | No (`winget install Google.OSVScanner` or scoop); not required, the auditor calls the OSV API directly |
