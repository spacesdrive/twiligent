# MCP Usage - Decision Guide

Four MCP servers are available. Each has a specific purpose. Using the wrong one wastes time and produces worse results than using the right one.

## Quick Decision Tree

```
Need API docs, library reference, or framework docs?
    -> Context7

Need to find a file, symbol, or understand the codebase?
    -> Filesystem (or direct Grep/Glob tools first)

Need to plan a complex feature, debug a hard problem, or think through architecture?
    -> Sequential Thinking

Need to research UX patterns, browser compat, competing products, or best practices?
    -> Parallel Search
```

## When Each MCP is the Right Choice

| MCP | Use it for | Do not use it for |
|---|---|---|
| **Context7** | Hono API, Supabase JS methods, Instagram Graph API params, Cloudflare Workers API, Recharts props, shadcn component props | Writing code, debugging business logic, code review, general programming |
| **Filesystem** | Finding where a function is defined, locating all files that import a module, moving/renaming across multiple files | Writing code, understanding architecture (read the docs instead), large-scale analysis |
| **Sequential Thinking** | Planning a multi-step feature before implementing, architecture decisions, debugging when root cause is not obvious | Lookups (use Context7), simple one-step tasks |
| **Parallel Search** | UX research for a new feature, browser API compatibility, finding how competitors handle a UI problem, finding accessibility guidelines | Library docs (use Context7), codebase exploration (use Filesystem) |

## Workflow Examples

### Adding Instagram Reels support to the publisher

1. **Sequential Thinking** - plan the full implementation (backend params, frontend UI changes, DB schema changes if any)
2. **Context7** - look up Instagram Graph API Reels container params (`media_type=REELS`, required fields)
3. **Parallel Search** - research UX patterns for Reels upload interfaces
4. Implement

### Debugging a Supabase query that returns wrong data

1. **Filesystem** - find all callers of the function to understand the context
2. **Context7** - look up Supabase `select()`, `eq()`, `single()` semantics if the issue might be a library API misunderstanding
3. **Sequential Thinking** - if the root cause is still unclear, walk through the data flow step by step

### Adding a new shadcn component

1. **Context7** - get the exact props and composition for the component
2. Direct implementation - no other MCP needed

### Deciding whether to add a new npm dependency

1. **Sequential Thinking** - analyze the trade-offs (bundle size, alternatives, maintenance)
2. **Parallel Search** - check if there is a lightweight alternative or a Web API equivalent

## Detailed Docs

- `docs/mcp/CONTEXT7.md` - when, how, and example queries
- `docs/mcp/FILESYSTEM.md` - file search, symbol location, refactoring
- `docs/mcp/SEQUENTIAL_THINKING.md` - planning and debugging
- `docs/mcp/PARALLEL_SEARCH.md` - research workflows
