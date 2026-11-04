# Third-Party Notices

Twiligent includes work by others under their own licences. This file gives the credit those licences ask for.

## Solar icons

- **Used in:** the public site (`site/`), generated into `site/src/components/icons.tsx` by `site/build/genIcons.ts`
- **Author:** 480 Design
- **Source:** [Solar Icons Set](https://www.figma.com/community/file/1166831539721848736), through the `@iconify-json/solar` package
- **Licence:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Changes:** a selection of the icons, converted to React components that draw in the current text colour. The drawings themselves are unchanged.

## Intent UI chart components

- **Used in:** the app (`frontend/`): `src/components/ui/chart.tsx`, `area-chart.tsx`, `bar-chart.tsx`, `line-chart.tsx` and `src/lib/primitive.ts`
- **Author:** Irsyad A. Panjaitan
- **Source:** [Intent UI](https://intentui.com), [github.com/intentui/intentui](https://github.com/intentui/intentui), taken from its shadcn registry (`@intentui/chart`, `area-chart`, `bar-chart`, `line-chart`, `primitive`) on 2026-11-05
- **Licence:** MIT. Copyright (c) 2024 Irsyad A. Panjaitan. The full MIT text is at the end of this file
- **Changes:** class names merge through the app's own `cn()` instead of the `cn` package; React Aria's `selected:` variant is written as `data-selected:` so no Tailwind plugin is needed; the tooltip's overlay colours map to the app's surface and ink tokens; legend buttons take their accessible name from their visible label

## Bencho blocks

- **Used in:** the app (`frontend/`): `src/components/RollingNumber.tsx` with `src/lib/rollingNumber.ts`, adapted from the Rolling counter block, and `src/components/StackedBars.tsx` with `src/lib/stackedBars.ts`, adapted from the Stacked bars block; their styles are the `.roll-*` and `.stb-*` rules in `src/index.css`
- **Author:** Lorenzo Cabra
- **Source:** [bencho.dev](https://bencho.dev), the free blocks' Code pane, read on 2026-11-05 without an account (the licence calls these free blocks MIT)
- **Licence:** MIT. Copyright (c) 2026 Lorenzo Cabra. The full MIT text is at the end of this file. "Bencho" is the author's trademark and is not used in the product
- **Changes:** Rolling counter's odometer strips are kept and its number input with buttons, drag and sounds is left out, so it only displays a value. Stacked bars draws real data from props in the app's design tokens, sizes itself to its box, glides with CSS transitions instead of framer-motion, and adds the arrow keys, an announced status line and a legend

The works above marked MIT are given under this text, with their own copyright line:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
