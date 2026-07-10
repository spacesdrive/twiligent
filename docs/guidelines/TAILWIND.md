# Tailwind CSS v4 Guidelines

## Version

This project uses **Tailwind CSS v4**. The v4 API is substantially different from v3:
- Configuration is done via CSS `@theme` instead of `tailwind.config.js`
- No `tailwind.config.js` exists - do not create one
- Use `@import "tailwindcss"` in the main CSS entry point
- Utility classes are the same as v3 in most cases

## Token References

Design tokens are defined in the CSS file (check `frontend/src/index.css` or `frontend/src/app.css` for the `@theme` block). Use these tokens via their utility class names - never use hardcoded hex values in class names.

Common token utilities:
- `bg-background` / `text-foreground` - page background and main text
- `bg-card` / `text-card-foreground` - card surfaces
- `bg-muted` / `text-muted-foreground` - subdued backgrounds and secondary text
- `border-border` - default border color
- `bg-primary` / `text-primary-foreground` - primary action color
- `bg-destructive` / `text-destructive-foreground` - error/delete actions

## Layout

### Page wrapper

```jsx
<div className="p-6 space-y-6">
  {/* page content */}
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
- `p-6` - standard page padding
- `p-4` - card inner padding
- `gap-4` - grid column gap
- `gap-2` - inline icon+label gap
- `space-y-6` - vertical rhythm between major sections
- `space-y-4` - vertical rhythm within a card
- `mb-4` / `mb-6` - heading bottom margin

## Typography

```jsx
<h1 className="text-2xl font-bold">Page Title</h1>
<h2 className="text-lg font-semibold">Section</h2>
<p className="text-sm text-muted-foreground">Secondary info</p>
```

Avoid using `text-xs` for anything the user needs to read comfortably. Use `text-sm` as the minimum for content.

## Responsive

Mobile-first. Most pages in this app are designed primarily for desktop (analytics dashboards), but keep them usable on mobile:
- Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for stat card rows
- Use `overflow-x-auto` on table wrappers
- Use `hidden md:flex` to hide elements that don't fit on mobile

## Dark Mode

This project uses shadcn's theme system, which manages light/dark via CSS custom properties - not Tailwind's `dark:` variant. Do not use `dark:` variants. Use token-based colors (`bg-card`, `text-muted-foreground`) which automatically respond to the theme.

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
