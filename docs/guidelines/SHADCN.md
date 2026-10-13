# shadcn/ui Standards

## Configuration

```json
// frontend/components.json (excerpt)
{
    "style": "base-nova",
    "rsc": false,
    "tsx": true,
    "tailwind": { "config": "", "css": "src/index.css", "cssVariables": true },
    "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" }
}
```

Style: `base-nova`. CSS variables: enabled. TypeScript: `tsx: true`, so the CLI writes `.tsx` files. `tailwind.config` is empty because Tailwind v4 is configured in `src/index.css`.

## Import Pattern

Always import from the local `@/components/ui/` path:

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
```

Never import from `shadcn/ui` directly - the components are copied into the project.

## Adding a New Component

```bash
cd frontend
npx shadcn add <component-name>
```

Run the CLI from `frontend/`, where `components.json` lives. The `shadcn` CLI is a dependency of the frontend workspace, so `npx shadcn` uses the version pinned in the root `package-lock.json`. If the CLI installs npm packages for a component, check afterwards that no `frontend/package-lock.json` was created; the root lockfile is the only one, and a stray workspace lockfile should be deleted and `npm install` run again at the root.

This copies the component source into `frontend/src/components/ui/` as a `.tsx` file, following the official base-nova TypeScript sources. Run `npm run typecheck` from the root afterwards.

## Composition Rules

shadcn components are composed using their named export variants. Read the component file in `frontend/src/components/ui/` to understand the available props before using them.

```tsx
// Card composition
<Card>
    <CardHeader>
        <CardTitle>Title</CardTitle>
        <CardDescription>Subtitle</CardDescription>
    </CardHeader>
    <CardContent>
        {/* content */}
    </CardContent>
    <CardFooter>
        {/* actions */}
    </CardFooter>
</Card>
```

## Common Components in Use

| Component | Import | Use case |
|---|---|---|
| `Button` | `@/components/ui/button` | All action buttons; use `variant` prop: `default`, `outline`, `ghost`, `destructive` |
| `Card`, `CardHeader`, `CardContent`, `CardFooter` | `@/components/ui/card` | Content containers |
| `Badge` | `@/components/ui/badge` | Status labels, platform tags |
| `Avatar` | `@/components/ui/avatar` | Channel/account avatars |
| `Table`, `TableHeader`, etc. | `@/components/ui/table` | Data tables |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `@/components/ui/tabs` | View switching |
| `Dialog`, `DialogContent`, etc. | `@/components/ui/dialog` | Modals |
| `Select`, `SelectTrigger`, etc. | `@/components/ui/select` | Dropdown selects |
| `Tooltip`, `TooltipContent`, etc. | `@/components/ui/tooltip` | Hover tooltips |
| `Skeleton` | `@/components/ui/skeleton` | Loading placeholders |
| `Alert`, `AlertTitle`, `AlertDescription` | `@/components/ui/alert` | Info/warning/error banners |
| `Input` | `@/components/ui/input` | Text inputs |
| `Label` | `@/components/ui/label` | Form labels |

## `cn()` Utility

Always use `cn()` from `@/lib/utils` to combine class names - it handles conditional classes and tailwind-merge conflicts:

```tsx
import { cn } from '@/lib/utils';

<div className={cn('base-class', isActive && 'active-class', className)}>
```

## Shared components

Project components in `frontend/src/components/` sit on top of the shadcn primitives. Use them before composing primitives by hand. `MetricBox` is the KPI tile used across analytics pages:

```tsx
import MetricBox from '@/components/MetricBox';

<MetricBox
    icon={<Eye />}
    label="Total views"
    value={fmtNum(analytics.totalViews)}
    subtitle="Lifetime channel views"
    highlight
/>
```

The full list (`PageHeader`, `SurfaceBox`, `ConfirmDialog`, `FilterChips`, and others) is in `docs/architecture/frontend/DESIGN_SYSTEM.md`.

The shadcn primitives in `components/ui/` are restyled onto the design tokens. Keep that styling when regenerating a primitive with the shadcn CLI: diff the new file against the current one before overwriting.

## Theme

The project uses `next-themes` with `attribute="class"`. Dark mode is applied by adding the `dark` class to `<html>`. All shadcn components respond to this automatically via CSS variables defined in `frontend/src/index.css`.

Do not hardcode colors in components - use Tailwind semantic classes (`text-muted-foreground`, `bg-card`, `border-border`, etc.) that reference CSS variables.
