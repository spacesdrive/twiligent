import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge"

// the design tokens' own sizes and radii must be known here, or text-small next to a colour class is dropped as a colour
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "page-title", "section", "body", "small", "caption", "metric"],
      radius: ["row", "control", "field", "card", "panel", "dialog", "pill"],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
