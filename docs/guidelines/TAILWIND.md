# Tailwind CSS v4 Guidelines

## Version

This project uses **Tailwind CSS v4**. The v4 API is substantially different from v3:
- Configuration is done via CSS `@theme` instead of `tailwind.config.js`
- No `tailwind.config.js` exists - do not create one
- Use `@import "tailwindcss"` in the main CSS entry point
- Utility classes are the same as v3 in most cases

## Token References

Design tokens are defined in `frontend/src/index.css` and listed in `docs/architecture/frontend/DESIGN_SYSTEM.md`. Use them through their utility class names. Never use hex values or Tailwind palette colours (`bg-red-500`, `text-pink-600`) in components.

Common token utilities:
- `bg-surface` / `text-ink` - page background and main text
- `bg-surface-raised` - cards and panels
- `bg-surface-sunken` / `text-ink-muted` / `text-ink-faint` - wells and secondary text
- `border-line` - hairline borders; `border-line-control` - control borders
- `bg-brand` / `text-on-brand` - primary action; `text-brand-text` - red as text
- `bg-danger-soft` / `text-danger`, plus `success`, `warning`, `info` - status

The shadcn names (`bg-background`, `text-muted-foreground`, `bg-primary`) still work and map onto the same tokens.

## Layout

### Page wrapper

The app shell already pads and centres the content column. Pages start with a flex column:

```jsx
<div className="flex flex-col gap-6">
  <PageHeader title="Videos" description="..." actions={...} />
  {/* sections */}
</div>
```

### Grid layouts

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* stat cards */}
</div>
```

### Flex rows

```jsx
<div className="flex items-center gap-2">
  {/* icon + label */}
</div>
```

## Spacing System

Use the spacing scale consistently. Common patterns in this project:
- `gap-6` - between page sections (`gap-8` on pages with large sections)
- `gap-3` - between metric boxes in a grid
- `gap-4` - between boxes in a grid
- `px-5 py-4` - inside a `SurfaceBox` (built in)
- `gap-2` - inline icon and label
- Prefer `gap-*` on flex and grid over `space-y-*`

## Typography

Use `PageHeader` for the page title and `SectionHeader` or a `SurfaceBox` title for sections. When writing type directly:

```jsx
<h1 className="font-heading text-page-title font-semibold">Page title</h1>
<h2 className="font-heading text-section font-semibold">Section</h2>
<p className="text-small text-ink-muted">Secondary info</p>
<span className="font-mono text-caption tabular-nums">42</span>
```

Avoid using `text-xs` for anything the user needs to read comfortably. Use `text-sm` as the minimum for content.

## Responsive

Mobile-first. Most pages in this app are designed primarily for desktop (analytics dashboards), but keep them usable on mobile:
- Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for stat card rows
- Use `overflow-x-auto` on table wrappers
- Use `hidden md:flex` to hide elements that don't fit on mobile

## Dark Mode

Light and dark values are both defined as tokens, so token utilities switch automatically. Do not use `dark:` variants for colour. The one sanctioned use of `dark:` is swapping the logo file in `components/brand/Logo.jsx`.

If you need to add a custom dark-mode variant for non-token colors, add a CSS custom property to the `@theme` block instead.

## The `cn()` Utility

Use `cn()` (from `@/lib/utils`) for conditional class merging:

```jsx
import { cn } from '@/lib/utils';

<div className={cn(
    'base-class',
    isActive && 'bg-primary text-primary-foreground',
    className   // allow parent to override
)} />
```

Never use template literals for conditional classes - they won't be properly merged and can produce duplicate or conflicting utilities.

## What Not To Do

- Do not use `style={{}}` for values that can be expressed as Tailwind utilities
- Do not hardcode colors in class names (`text-[#ff0000]`) - use design token utilities
- Do not use `!important` (`!text-red-500`) unless debugging a specificity conflict
- Do not create a `tailwind.config.js` - configuration lives in the CSS `@theme` block in v4
- Do not use `dark:` prefix variants - theme is token-based, not class-based
