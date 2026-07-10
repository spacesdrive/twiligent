# MCP: Filesystem — Codebase Navigation

## Purpose

Filesystem MCP provides advanced file operations: recursive search, directory trees, file reading, and moving files. Use it for exploration tasks that require looking at multiple files or the full directory structure.

## When to Use

✅ **Use Filesystem for:**
- Finding all files that import a specific module
- Getting a directory tree to understand project structure
- Searching for all uses of a function or variable name
- Moving or renaming files and updating all imports
- Reading multiple related files simultaneously

❌ **Do not use Filesystem when:**
- You know the exact file path (use Read tool directly)
- You're looking for a single string (use Grep tool directly)
- You're searching for a file by pattern (use Glob tool directly)

## Common Workflows

### Find all callers of a function

```
filesystem: search_files
pattern: "safeAccount"
path: backend/
```

Better: Use the built-in Grep tool for this — it's faster for string search.

### Get directory structure

```
filesystem: directory_tree
path: frontend/src/features/
```

### Find all route files

```
filesystem: list_directory
path: backend/routes/
```

### Find all components that use AppContext

```
filesystem: search_files
pattern: "useAppContext"
path: frontend/src/
```

## When to Use Grep/Glob Instead

The built-in Grep and Glob tools are faster for most search tasks:

- `Grep pattern="useAppContext"` — faster than filesystem search for string patterns
- `Glob pattern="backend/routes/*.js"` — faster than filesystem for file patterns
- `Read file_path="..."` — faster than filesystem for single file reads

Use Filesystem MCP when you need its specific features: recursive directory trees, multi-file reads in one call, or file move operations.

## Refactoring Workflow

When renaming a function or moving a file:

1. Filesystem: find all files that reference the old name
2. Edit each file
3. Verify with Grep that no old references remain

Example: renaming `safeAccount` to `stripSensitiveFields`:
1. `search_files pattern="safeAccount" path="backend/"` → list of files
2. Edit each file
3. `Grep pattern="safeAccount"` → should return empty
