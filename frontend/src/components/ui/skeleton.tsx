import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-control bg-surface-sunken", className)}
      {...props} />
  );
}

export { Skeleton }
