import type * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"

// decorative: the busy button label or the surrounding status region says what is happening
function Spinner({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <span data-slot="spinner" className="delayed-appear inline-flex shrink-0" aria-hidden="true">
      <Loader2Icon
        className={cn("size-4 animate-spin", className)}
        {...props} />
    </span>
  );
}

export { Spinner }
