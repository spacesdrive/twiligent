"use client"
// Intent UI (https://intentui.com, MIT), vendored; see THIRD_PARTY_NOTICES.md

import { composeRenderProps } from "react-aria-components/composeRenderProps"
import type { ClassNameValue } from "tailwind-merge"
import { cn } from "@/lib/utils"

type Render<T> = string | ((v: T) => string) | undefined

export function cx<T = unknown>(
  ...classes: [...ClassNameValue[], Render<T>]
): string | ((v: T) => string) {
  const className = classes.pop() as Render<T>

  return composeRenderProps(className, (className) => cn(classes, className))
}
