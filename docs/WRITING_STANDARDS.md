# Writing and Design Standards

These rules apply to all generated code, documentation, UI copy, commit messages, comments, and any user-facing text in this project. Follow them without exception.

---

## Typography

- Never use emojis.
- Never use Unicode emoji icons.
- Never use emoticons.
- Never use em dashes (--). Use a standard hyphen (-) or restructure the sentence.
- Never use en dashes where a hyphen is appropriate.
- Always use standard ASCII hyphens (-).

---

## Icons

- Never use emoji as icons in UI.
- Use SVG icons only.
- In the app (`frontend/`), prefer Lucide React icons (`lucide-react`) at a 1.75 stroke. Platform logos (YouTube, Instagram, Reddit) come from `components/brand/platform-icons.tsx`.
- If Lucide does not have an appropriate icon, use another open-source SVG icon library (e.g. Heroicons, Radix Icons).
- On the public site (`site/`), use the Solar icons (480 Design, CC BY 4.0, credited in `THIRD_PARTY_NOTICES.md`) generated into `site/src/components/icons.tsx`: the bold style for things and places, the linear style for small controls. Add an icon to the list in `site/build/genIcons.ts` and run `npm run icons --workspace site`. Platform logos on the site come from `site/src/components/marks.tsx`. The owner chose Solar for the site on 2026-10-15; the app keeps Lucide.
- All icons in the same UI context must have consistent size, stroke width, spacing, and visual weight.

---

## Writing Style

Write in clear, professional English.

Avoid:

- Unnecessary buzzwords
- Filler text or padding sentences
- Exaggerated marketing language ("powerful", "blazing fast", "revolutionary")
- Repetitive wording across adjacent sentences

Prefer:

- Concise, direct sentences
- Descriptive headings that name the content, not the type of content
- Readable formatting with appropriate whitespace
- Consistent terminology throughout the project (pick one name for a concept and use it everywhere)

---

## Markdown

Use clean Markdown in all documentation.

Prefer:

- Headings for structure
- Bullet lists for non-sequential items
- Numbered lists for steps or ordered items
- Tables when comparing or listing structured data

Avoid:

- Excessive bold formatting (bold is for the single most critical item in a block, not decoration)
- Nested bullet lists deeper than two levels
- HTML tags inside Markdown except when necessary

---

## Code Comments

Add a comment only when the WHY is non-obvious: a hidden constraint, a subtle invariant, a workaround for a specific external bug, or behavior that would surprise a future reader.

Do not add comments that:

- Describe what the code does (well-named identifiers already do that)
- Reference the current task, ticket, or PR ("added for issue #123")
- Explain callers or downstream effects ("used by X")
- Restate what is visible in the code

One short line per comment, maximum. No multi-paragraph comment blocks.

---

## UI Copy

Write from the user's perspective, not the system's internals.

- Name things by what the user recognizes, not how the code is structured
- Action labels describe exactly what happens: "Publish" not "Submit", "Delete account" not "Remove"
- Success feedback confirms what happened: "Post published" not "Success"
- Error messages explain what went wrong and what to do: "Instagram token expired - reconnect your account" not "Authentication error"
- No apologies in error messages
- No vague messages like "Something went wrong"

---

## Commit Messages

Follow Conventional Commits format (see `docs/workflows/GIT.md` for full details).

- Subject line: type(scope): short imperative sentence
- No period at the end of the subject line
- Subject line under 72 characters
- No emojis or decorative characters
- Past tense is wrong: "add" not "added", "fix" not "fixed"
- Body is optional; include it when the why is non-obvious

---

## UI Consistency

Every page must feel like it belongs to the same application.

Maintain:

- One `PageHeader` per page; the app shell provides page padding
- Consistent vertical rhythm (`flex flex-col gap-6` between sections)
- Consistent containers (`SurfaceBox`, `MetricBox`) and design tokens only, no palette colours
- Consistent loading states (`PageSkeleton`, `Skeleton`), empty states (`EmptyState`) and error display (toasts via `showToast`)
- Consistent icon usage (Lucide, 1.75 stroke)
- Consistent button variants (default for the main action, outline for secondary, ghost for tertiary)
- Destructive actions confirmed with `ConfirmDialog` and `hold`
- Sentence case in all UI copy, and no exclamation marks

See `docs/architecture/frontend/DESIGN_SYSTEM.md` and `docs/design-reference.md`.

The entire project should feel like one polished application, not independently built pages.
