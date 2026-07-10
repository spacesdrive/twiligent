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

Do not commit work-in-progress that breaks the build. Use a feature branch if the work spans multiple sessions.

---

## Commit Message Format

Use Conventional Commits with an optional scope:

```
type(scope): short description in present tense

Optional body explaining WHY, not WHAT. Wrap at 72 characters.
Reference which docs were updated if any.
```

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
- A new route + its db.js functions + its api.js method
- A new page + its route in App.jsx + its Sidebar entry
- A bug fix + updated docs if the fix changes documented behavior
- A new feature + CHANGELOG.md update + relevant architecture doc updates

### Never commit:
- `backend/.dev.vars`
- `backend/data/`
- `node_modules/`
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

1. Update `CHANGELOG.md`: move Unreleased section to the new version number with today's date
2. Commit: `release: v1.1.0 - short description of release`
3. Tag: `git tag -a v1.1.0 -m "v1.1.0 - short description"`
4. Push: `git push origin main --tags`

```bash
# Example release
git add CHANGELOG.md
git commit -m "release: v1.1.0 - Reddit analytics integration"
git tag -a v1.1.0 -m "v1.1.0 - Reddit analytics integration"
git push origin main --tags
```

---

## Branch Strategy

All work goes directly to `main` for small changes and fixes. GitHub Actions deploys automatically on push to `main`.

For larger features that span multiple sessions or commits before they are ready to deploy, use a feature branch:

```bash
git checkout -b feat/reddit-integration
# work, commit incrementally
git push origin feat/reddit-integration
# merge to main when ready
git checkout main
git merge feat/reddit-integration
git push origin main
```

Delete the branch after merging:
```bash
git push origin --delete feat/reddit-integration
git branch -d feat/reddit-integration
```

---

## Pre-Commit Checklist

Run before every commit:

1. `cd frontend && npm run build` - frontend must build without errors
2. `cd frontend && npm run lint` - no lint errors
3. `git status` - verify only intended files are staged
4. `git diff --staged` - review the full diff before committing
5. Check no secrets or credentials appear in the diff
6. Verify CHANGELOG.md is updated if the commit adds a feature or fix

---

## Post-Commit

After pushing to `main`, monitor GitHub Actions:

- `backend/` changes trigger `deploy-backend.yml`
- `frontend/` changes trigger `deploy-frontend.yml`
- `scripts/` changes do not trigger automatic deployment

If a deployment workflow fails:
1. Read the failure log at https://github.com/spacesdrive/twiligent/actions
2. Fix the issue locally
3. Create a new commit (never amend a published commit)
4. Push the fix
