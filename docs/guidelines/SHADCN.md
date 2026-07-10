# shadcn/ui Standards

## Configuration

```json
// frontend/components.json
{
    "style": "base-nova",
    "rsc": false,
    "tsx": false,
    "tailwind": { "cssVariables": true },
    "aliases": { "components": "@/components", "utils": "@/lib/utils" }
}
```

Style: `base-nova`. CSS variables: enabled. No TypeScript (tsx: false).

## Import Pattern

Always import from the local `@/components/ui/` path:

```jsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
```

Never import from `shadcn/ui` directly - the components are copied into the project.

## Adding a New Component

```bash
cd frontend
npx shadcn@latest add <component-name>
```

This copies the component source into `frontend/src/components/ui/`. After adding, verify the generated file uses `.jsx` (not `.tsx`). The `components.json` configuration should handle this automatically.

## Composition Rules

shadcn components are composed using their named export variants. Read the component file in `frontend/src/components/ui/` to understand the available props before using them.

```jsx
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

```jsx
import { cn } from '@/lib/utils';

<div className={cn('base-class', isActive && 'active-class', className)}>
```

## StatCard Component

A custom component at `frontend/src/components/ui/StatCard.jsx` is a KPI tile used across all analytics pages. Use it for metric display:

```jsx
import StatCard from '@/components/ui/StatCard';

<StatCard
    title="Total Views"
    value={fmtNum(analytics.totalViews)}
    icon={Eye}
    description="Lifetime channel views"
/>
```

## Theme

The project uses `next-themes` with `attribute="class"`. Dark mode is applied by adding the `dark` class to `<html>`. All shadcn components respond to this automatically via CSS variables defined in `frontend/src/index.css`.

Do not hardcode colors in components - use Tailwind semantic classes (`text-muted-foreground`, `bg-card`, `border-border`, etc.) that reference CSS variables.
