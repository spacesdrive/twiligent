# Issue Tracking

Every change to this repository is tracked by a GitHub issue at https://github.com/spacesdrive/twiligent/issues. Features, fixes, refactors, documentation, dependency updates and deployments all count. The issue is opened before the work starts and closed when the work is complete.

The `gh` CLI is authenticated as `spacesdrive`; run every command from the repository root.

---

## Lifecycle

1. **Search first.** `gh issue list --state open --search "<keywords>"`. If an open issue already covers the work, use it instead of opening a duplicate.
2. **Open the issue before writing code.** Title, body and labels follow the format below. A task with several independent parts gets a parent issue plus one sub-issue per part.
3. **Reference it in every commit.** Put `Refs #N` in the commit body while the work is in progress. Put `Closes #N` in the commit or pull request that finishes it.
4. **Report progress.** Tick the task list in the issue body as parts finish (`gh issue edit N --body-file <file>`). Record decisions, blockers and scope changes as comments (`gh issue comment N --body "..."`).
5. **Close it when the work is complete.** Complete means the code is committed and pushed, the docs listed in the Documentation Maintenance Policy are updated, and the checks in `docs/workflows/TESTING.md` pass. GitHub closes the issue automatically when a commit containing `Closes #N` reaches `main`. If it was not closed that way (the work was merged differently, or the issue needed no commit), close it by hand with a summary:

   ```bash
   gh issue close N --comment "Done in <commit or PR>. <one line on what changed and how it was verified>"
   ```

6. **Close a parent last.** A parent issue closes only after all its sub-issues are closed.
7. **Unfinished work stays open.** If a session ends before the work is done, leave the issue open and add a comment with what is finished and what remains. Never close an issue for work that is not done; close it as "not planned" (`gh issue close N --reason "not planned" --comment "..."`) only when the work is abandoned.

---

## Title and Body

- Title: sentence case, imperative, under 72 characters, no type prefix and no trailing period. "Add rate limiting to the API", not "feat: rate limiter".
- Body: one short paragraph on the problem or goal, then a `- [ ]` task list, then a "Done when" line that says how completion is verified.
- Bugs also state the steps to reproduce, what happened and what was expected.
- Never paste secrets, tokens, `.dev.vars` contents, user emails or other personal data into an issue. Issues on this repository are public.

The templates in `.github/ISSUE_TEMPLATE/` give this structure in the GitHub web form.

---

## Labels

| Label | Use for |
|---|---|
| `enhancement` | New features and capabilities |
| `bug` | Behaviour that does not match the docs or user expectations |
| `documentation` | Docs-only work, or the docs part of a larger change |
| `security` | Hardening, access control, secrets handling, rate limiting |
| `typescript` | The TypeScript migration and type-only changes |

Add a new label with `gh label create <name> --color <hex> --description "<text>"` and list it in this table.

---

## Sub-issues

Link a child issue to its parent with the GitHub sub-issues API. It takes the child's numeric `id`, not its number:

```bash
child_id=$(gh api repos/spacesdrive/twiligent/issues/<child-number> --jq .id)
gh api -X POST repos/spacesdrive/twiligent/issues/<parent-number>/sub_issues -F sub_issue_id=$child_id
```

---

## Pull Requests

A change that goes through a branch (see `docs/workflows/GIT.md`) is opened as a pull request. The body lists `Closes #N` for every issue it finishes, so merging closes them. The template in `.github/pull_request_template.md` has the sections.

---

## Roadmap Items

`ROADMAP.md` lists planned work. When work on a roadmap item starts, open an issue for it and link the issue from the roadmap entry. When the issue closes, move the entry to `CHANGELOG.md` and remove it from the roadmap.
