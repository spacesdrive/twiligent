# MCP: Parallel Search - Research

## Purpose

Parallel Search fetches current web content for research tasks: UX patterns, browser compatibility, best practices, competing implementations, and up-to-date API behavior when Context7 doesn't have it.

## When to Use

✅ **Use Parallel Search for:**
- UX patterns for a feature you're designing ("how do social media schedulers handle bulk post editing?")
- Browser/platform compatibility ("does Instagram Graph API support carousel posts on all account types?")
- Recent API changes not yet in Context7 ("Instagram Graph API v21 vs v25 container creation changes")
- Accessibility guidelines ("WCAG criteria for data table accessibility")
- Competitor analysis ("how does Buffer/Hootsuite handle the scheduling queue UI?")
- Current events ("is Upstash Redis still recommended for Cloudflare Workers in 2025?")

❌ **Do not use Parallel Search for:**
- Library API docs with stable method signatures (use Context7)
- Codebase exploration (use Filesystem)
- Architecture planning (use Sequential Thinking)
- When you already know the answer from existing docs

## Research Workflow

### UX Research for a New Feature

1. Identify what you're designing (e.g., a post scheduling calendar view)
2. Use Parallel Search with 2-3 queries:
   - "social media scheduling calendar UX patterns 2024"
   - "how Hootsuite implements scheduling calendar"
   - "time slot selection UI accessibility"
3. Extract the patterns relevant to this project's constraints (mobile-first, React)
4. Apply the patterns - document sources in a code comment if the pattern is non-obvious

### API Behavior Research

When Instagram/YouTube API behavior is unclear or seems different from Context7 docs:

1. Search for recent issues or changelogs
2. Check the official API changelog (graph.facebook.com/changelog, developers.google.com/youtube/v3/revision_history)
3. Look for Stack Overflow or GitHub issues with the specific error/behavior

### Accessibility Research

Before building any interactive feature:

1. Search "WCAG 2.1 {feature type}" - e.g., "WCAG 2.1 date picker accessibility"
2. Check MDN for the correct ARIA roles and attributes
3. Apply what you find - shadcn components already include correct ARIA in most cases

## Multiple Search Queries

Parallel Search can issue multiple queries at once. When researching a feature, batch related queries:

```
Search queries:
1. "instagram graph api reels container creation required fields 2025"
2. "instagram graph api video processing status polling best practices"
3. "instagram reels api error codes"
```

This returns results faster than sequential searches.

## Integration with Implementation

Research findings should inform the implementation but not be pasted verbatim into code. Extract:
- The pattern or API contract
- Any constraints or gotchas
- The recommended approach

Then implement using the project's own style and conventions.
