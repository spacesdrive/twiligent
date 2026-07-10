# MCP: Sequential Thinking - Planning and Debugging

## Purpose

Sequential Thinking enables structured, step-by-step reasoning for complex problems. Use it before implementing anything non-trivial to produce a verified plan - not a list of guesses.

## When to Use

✅ **Use Sequential Thinking for:**
- Planning a new feature that touches more than 3 files
- Architecture decisions with multiple viable approaches
- Debugging when the root cause is not immediately obvious
- Multi-step database migrations
- Features that require coordinating frontend + backend + DB changes
- Evaluating trade-offs between approaches

❌ **Do not use Sequential Thinking for:**
- Simple, well-understood tasks (adding a route that follows an existing pattern exactly)
- Library API lookups (use Context7)
- File searches (use Filesystem or Grep)

## Trigger Conditions

Consider Sequential Thinking when any of these are true:
- The feature requires changes to more than one layer (backend + frontend, or DB + backend)
- You're not sure which of two approaches is better
- You've read the code but the bug still isn't obvious
- The feature interacts with a security boundary (auth, token handling, RLS)
- You need to ensure a data flow is correct before implementing it

## Typical Reasoning Sequence for a New Feature

```
1. What is the user-visible goal?
2. What data does it need? (new? existing?)
3. Does the DB schema need to change?
4. What new backend routes are needed?
5. What does each route do? (DB queries, API calls, cache operations)
6. What new API methods does the frontend need?
7. What UI changes are needed? (new page? new component on existing page?)
8. What context or state changes are needed?
9. What are the security implications? (user isolation, token handling)
10. What can break? (cache invalidation, error states, missing data)
11. Ordered implementation steps
```

## Typical Debugging Sequence

```
1. What is the exact error message and stack trace?
2. What file and line does the error originate from?
3. What is the function doing at that line?
4. What are the inputs at that point? (log or inspect)
5. What does the function expect vs. what is it receiving?
6. Where is that input set? Trace backwards.
7. Is this a data shape mismatch, a timing issue, or a logic error?
8. What is the minimal change that fixes the root cause (not the symptom)?
```

## Examples

### Planning Reddit integration

Sequential Thinking would work through:
- Cookie-based auth vs OAuth (trade-offs, ToS risk)
- Which endpoints to call (`/user/{username}/submitted.json`, etc.)
- How to store credentials (in `accounts.data` jsonb alongside Instagram pattern)
- Token refresh strategy (poll `Set-Cookie` header on each API call)
- New cache keys to add to `cache.js`
- New routes to add to backend
- New analytics page structure
- How the sidebar/nav changes

### Debugging double-publishing

Sequential Thinking would walk through:
- The `getDuePosts()` query - what exactly does it return?
- The `status = 'publishing'` update - is it atomic?
- The race condition window between SELECT and UPDATE
- Whether Supabase/PostgreSQL guarantees isolation at the right level
- Whether the GitHub Actions workflow and Worker cron can actually overlap

## Integration with Other MCPs

Sequential Thinking + Context7: Plan first, then look up specific API details for the steps that require them.

Sequential Thinking + Parallel Search: Plan the technical approach, then research UX patterns for the user-facing parts.
