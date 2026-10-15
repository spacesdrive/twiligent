# Git Workflow

## Repository

- URL: https://github.com/spacesdrive/twiligent
- Author name: spacesdrive
- Author email: valzorx7@gmail.com
- Default branch: main

Commits must use the spacesdrive author identity. The local git config is set to this. Never override it per-commit with a different author.

Do not add "Co-Authored-By" lines referencing AI tools. Commits should show only the project author.

---

## Commit Cadence

Commit after every meaningful, self-contained change. Do not accumulate unrelated changes into one large commit. Do not leave work uncommitted between sessions.

A meaningful change is one that:
- Adds a working feature (even a small one)
- Fixes a bug
- Updates documentation to reflect a real change
- Refactors without changing behavior

Do not commit work-in-progress that breaks the build or the type check. Use a feature branch if the work spans multiple sessions.

---

## Commit Message Format

Use Conventional Commits with an optional scope:

```
type(scope): short description in present tense

Optional body explaining WHY, not WHAT. Wrap at 72 characters.
Reference which docs were updated if any.

Refs #12
```

### Issue reference

Every commit ends with a reference to the GitHub issue that tracks the work (see `docs/workflows/ISSUES.md`):

- `Refs #N` - the commit is part of the work; the issue stays open
- `Closes #N` - the commit completes the issue; GitHub closes it when the commit reaches `main`

A commit that finishes several issues lists each one: `Closes #3, closes #4`. A commit on a branch that closes an issue only takes effect when it is merged to `main`.

### Types

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructuring, no behavior change |
| `style` | Formatting or whitespace, no logic change |
| `perf` | Performance improvement |
| `chore` | Maintenance, dependency updates, tooling |
| `release` | Version bump and changelog update |

### Scope (optional)

Use scope to name the area affected:

- `feat(instagram):`
- `fix(scheduler):`
- `docs(routing):`
- `chore(deps):`

### Subject line rules

- Present tense: "add" not "added", "fix" not "fixed"
- No period at the end
- Under 72 characters total including type and scope
- Lowercase after the colon
- No emojis

### Examples

```
feat(reddit): add cookie-based analytics integration

fix(scheduler): strip non-ASCII characters from env vars to prevent ByteString error

docs(architecture): document dual-scheduler mutex pattern in SCHEDULING.md

refactor(instagram): extract token refresh into standalone service function

chore(deps): update @supabase/supabase-js to latest

release: v1.1.0 - Reddit integration
```

---

## What to Commit Together

### Always group these in a single commit:
- A new route + its controller, service and repository methods + its api.ts method
- A new page + its route in App.tsx + its Sidebar entry
- A bug fix + updated docs if the fix changes documented behavior
- A new feature + CHANGELOG.md update + relevant architecture doc updates
- A dependency change + the workspace `package.json` it touches + the root `package-lock.json`

### Never commit:
- `backend/.dev.vars`
- `backend/data/`
- `node_modules/`
- `backend/package-lock.json` or `frontend/package-lock.json` (only the root lockfile is committed; a lockfile inside a workspace means `npm install` ran in the wrong folder)
- `.env` files with real credential values
- Cloudflare API tokens or Supabase service keys
- Editor or OS metadata files (`.DS_Store`, `Thumbs.db`)

---

## Documentation in Commits

Every feature commit must include documentation updates. A feature is not complete until:
- `CHANGELOG.md` is updated (Unreleased section)
- Relevant architecture docs reflect the change (see `claude.md` Documentation Maintenance Policy)

Include in the commit body which docs were updated:

```
feat(schedule): add bulk CSV post scheduling

Users can now upload a CSV file to schedule multiple posts at once.
Each row in the CSV maps to one scheduled_post record.

Docs updated: ROUTES.md, SCHEDULING.md, CHANGELOG.md.

Closes #42
```

---

## Release Tagging

Tag releases after shipping a meaningful set of changes.

### Version numbering

| Change type | Version bump | Example |
|---|---|---|
| Bug fix | Patch: x.x.N+1 | v1.0.4 -> v1.0.5 |
| New feature | Minor: x.N+1.0 | v1.0.5 -> v1.1.0 |
| Breaking change | Major: N+1.0.0 | v1.1.0 -> v2.0.0 |

### Release process

`main` only accepts pull requests (see Branch Strategy), so the release commit goes through one too, and the tag is made on `main` after the merge, because a rebase merge gives the commit a new hash.

1. On a branch, update `CHANGELOG.md`: move the Unreleased section to the new version number with today's date
2. Commit: `release: v1.1.0 - short description of release`, open a pull request and merge it once CI passes
3. Tag the merged commit and push only the tag (tags are not protected)
4. Publish a GitHub Release page for the tag, with notes in the format below

```bash
# Example release
git switch -c release/v1.1.0
git add CHANGELOG.md
git commit -m "release: v1.1.0 - Reddit analytics integration"
git push -u origin release/v1.1.0
gh pr create --fill
# after the pull request is merged
git fetch origin
git tag -a v1.1.0 origin/main -m "v1.1.0 - Reddit analytics integration"
git push origin v1.1.0
gh release create v1.1.0 --verify-tag --title "v1.1.0 - Reddit analytics integration" --notes-file release-notes.md --latest
```

Write the notes file outside the repository; it is not committed.

### Release notes

Every tag gets a GitHub Release page at https://github.com/spacesdrive/twiligent/releases. Its notes explain the release in plain words to someone who uses or runs Twiligent; `CHANGELOG.md` keeps the full detail. The notes follow `docs/WRITING_STANDARDS.md`: no emojis, no em or en dashes, no exclamation marks, no marketing words.

| Part | What it holds |
|---|---|
| Title | The tag and the release commit's description: `v1.1.1 - Docs home fix and scheduler recovery` |
| Summary | One or two sentences on what the release changes for the person using it, before any heading |
| `## Added`, `## Changed`, `## Fixed` | Only the sections that have entries. One short line per change, in the user's words: what now works, not how the code changed. A handful of lines, not every changelog entry |
| `## Upgrading` | Only when an instance owner must act: SQL to run, a secret or setting to add or change. Give the exact SQL or name, say when to do it (before or after deploying), and link the docs page that has the same steps |
| Last line | `Full list of changes: [CHANGELOG.md](https://github.com/spacesdrive/twiligent/blob/vX.Y.Z/CHANGELOG.md)`, linked at the tag |

The newest release is marked `--latest`; publishing an older tag later uses `--latest=false`. Fix a mistake in published notes with `gh release edit vX.Y.Z --notes-file release-notes.md`.

---

## Branch Strategy

`main` is protected by the repository ruleset **Protect main** (Settings, Rules, Rulesets). Every change, however small, goes through a branch and a pull request, and GitHub Actions deploys both apps when it lands on `main`.

| Rule | Effect |
|---|---|
| Restrict deletions | `main` cannot be deleted |
| Block force pushes | History on `main` cannot be rewritten |
| Require a pull request before merging | Direct pushes to `main` are refused; no approval is required, so the owner can merge their own pull request |
| Require status checks to pass | The CI job `Type check, lint, test, build` (`.github/workflows/ci.yml`) must pass on the pull request, and the branch must be up to date with `main` |
| Require linear history | Pull requests merge with **Rebase and merge** (preferred, keeps one commit per change with its `Refs #N`) or **Squash and merge**; merge commits are refused |

Nobody bypasses the ruleset, including administrators. Renaming the CI job breaks the status check rule: update the ruleset in the same pull request (see `docs/architecture/cloudflare/CI_CD.md`).

```bash
git switch -c fix/scheduler-timezone
# work, commit with Refs #N
git push -u origin fix/scheduler-timezone
gh pr create --fill                      # body lists Closes #N, following .github/pull_request_template.md
gh pr checks --watch                     # wait for CI
gh pr merge --rebase --delete-branch     # once CI passes; this deploys both apps
```

If `main` moved on since the branch was made, the merge is refused until the branch is updated: `gh pr update-branch --rebase`, then wait for CI again.

A pull request can be stacked on another branch when it depends on unmerged work. Set its base to that branch, merge the lower pull request first, then change the upper one's base to `main` (`gh pr edit <n> --base main`) and rebase it before merging.

Delete the local branch after merging:
```bash
git switch main && git pull
git branch -d fix/scheduler-timezone
```

---

## Pre-Commit Checklist

Run before every commit:

Run the commands from the repository root:

1. `npm run typecheck` - every TypeScript project must type-check (Vite and Wrangler do not check types)
2. `npm run build` - frontend must build without errors
3. `npm test` - backend and frontend unit tests must pass
4. `npm run lint` - no new lint errors (one run covers backend, frontend, tests and scripts)
5. `git status` - verify only intended files are staged
6. `git diff --staged` - review the full diff before committing
7. Check no secrets or credentials appear in the diff
8. Check no lockfile appears inside `backend/` or `frontend/`; the root `package-lock.json` is the only lockfile
9. Verify CHANGELOG.md is updated if the commit adds a feature or fix
10. Verify the commit body ends with `Refs #N` or `Closes #N` for the tracking issue

---

## Post-Commit

After pushing to `main`, monitor GitHub Actions:

- `backend/` changes trigger `deploy-backend.yml`
- `frontend/` changes trigger `deploy-frontend.yml`
- `shared/`, `tsconfig.base.json`, root `package.json` or `package-lock.json` changes trigger both
- Every pull request and every push to another branch runs `ci.yml` (type check, lint, test, build, Worker dry-run)
- `scripts/` changes do not trigger automatic deployment

If a deployment workflow fails:
1. Read the failure log at https://github.com/spacesdrive/twiligent/actions
2. Open a `bug` issue for the failure, or comment on the issue the push was for
3. Fix the issue locally
4. Create a new commit (never amend a published commit) that references the issue
5. Push the fix

After the push, check that every issue the work finished is closed (`gh issue list --state open`). Close any that a `Closes #N` line did not close, with a comment naming the commit.
