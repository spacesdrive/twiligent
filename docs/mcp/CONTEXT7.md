# MCP: Context7 — Library Documentation

## Purpose

Context7 fetches current, version-accurate documentation for libraries and APIs. Use it whenever you need to look up:
- Method signatures and parameters
- API field names and enum values
- Configuration options
- Migration differences between versions
- Framework-specific patterns

## When to Use

✅ **Use Context7 for:**
- Instagram Graph API — container creation params, field names, error codes
- YouTube Data API v3 — endpoint params, quota costs, response shapes
- Hono v4 — middleware API, context methods, routing
- Supabase JS — client methods, query builder, auth API
- Cloudflare Workers — runtime APIs, `ctx.waitUntil()`, env bindings
- Recharts v3 — component props, data shapes, chart configuration
- shadcn/ui components — available props, slot composition
- React 19 — hooks API, new features
- React Router v7 — `createBrowserRouter`, `Outlet`, nested routes

❌ **Do not use Context7 for:**
- Debugging business logic (read the code instead)
- Code review
- Architecture decisions (use Sequential Thinking)
- General programming questions

## Workflow

1. `resolve-library-id` with the library name and your specific question
2. Review results — pick the ID with the most relevant description and highest score
3. `query-docs` with the selected ID and your full question
4. Apply the documentation to the implementation

## Example Queries

### Instagram Graph API

```
resolve-library-id: "instagram graph api media publish"
query-docs: "What parameters are required to create a Reels media container? 
             What is the field name for the video URL and share_to_feed?"
```

### Supabase upsert

```
resolve-library-id: "supabase javascript client"
query-docs: "How do I use upsert with onConflict to specify composite primary key columns?"
```

### Hono middleware context

```
resolve-library-id: "hono cloudflare workers"
query-docs: "How do I set and get values on the Hono context using c.set() and c.get()? 
             What is the TypeScript interface for custom context variables?"
```

### Recharts area chart

```
resolve-library-id: "recharts"
query-docs: "How do I create an AreaChart with multiple data series, 
             custom tooltips, and a responsive container?"
```

## Tips

- Be specific in your query — include the exact method name or concept
- If the first result doesn't match, try alternate names (e.g., "next.js" not "nextjs", "hono.js" not "honojs")
- Use version-specific IDs when the project is on a specific version and the API has changed recently
- The Supabase library has multiple IDs — prefer the one specifically for the JavaScript client
