import * as React from "react"

import { cn } from "@/lib/utils"
import { useSurfaceTitleId } from "@/components/surfaceTitle"

// a table wider than its box scrolls inside it, and the scroll box must then be reachable by keyboard
function useOverflows(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [overflows, setOverflows] = React.useState(false)
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setOverflows(node.scrollWidth > node.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    if (node.firstElementChild) observer.observe(node.firstElementChild)
    return () => observer.disconnect()
  }, [ref])
  return overflows
}

function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const overflows = useOverflows(containerRef)
  const surfaceTitleId = useSurfaceTitleId()
  const labelledBy = props["aria-label"] ? undefined : (props["aria-labelledby"] ?? surfaceTitleId)
  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", containerClassName)}
      {...(overflows
        ? { tabIndex: 0, role: "region", "aria-labelledby": labelledBy, "aria-label": props["aria-label"] }
        : {})}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        aria-labelledby={labelledBy}
        {...props} />
    </div>
  );
}

function TableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:border-line [&_tr]:hover:bg-transparent", className)}
      {...props} />
  );
}

function TableBody({
  className,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props} />
  );
}

function TableFooter({
  className,
  ...props
}: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t border-line bg-surface-sunken/60 font-medium [&>tr]:last:border-b-0", className)}
      {...props} />
  );
}

function TableRow({
  className,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-divider transition-colors duration-(--duration-fast) hover:bg-surface-hover has-aria-expanded:bg-surface-hover data-[state=selected]:bg-surface-selected",
        className
      )}
      {...props} />
  );
}

function TableHead({
  className,
  scope = "col",
  ...props
}: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      className={cn(
        "h-10 px-3 text-left align-middle text-caption font-medium whitespace-nowrap text-ink-muted [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props} />
  );
}

function TableCell({
  className,
  ...props
}: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2.5 align-middle whitespace-nowrap tabular-nums [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props} />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-ink-muted", className)}
      {...props} />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
