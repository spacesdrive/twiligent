import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  ...props
}) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-field border border-input bg-surface-raised px-3 py-2 text-base text-ink transition-colors duration-(--duration-fast) outline-none placeholder:text-ink-faint hover:border-ink-muted focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60 aria-invalid:border-danger md:text-sm",
        className
      )}
      {...props} />
  );
}

export { Textarea }
