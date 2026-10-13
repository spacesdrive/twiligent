import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-control border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-colors duration-(--duration-fast) outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:stroke-[1.75] [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-hover",
        outline:
          "border-line-control bg-surface text-ink hover:bg-surface-hover aria-expanded:bg-surface-hover",
        secondary:
          "bg-surface-sunken text-ink hover:bg-surface-selected aria-expanded:bg-surface-selected",
        ghost:
          "text-ink-muted hover:bg-surface-hover hover:text-ink aria-expanded:bg-surface-hover aria-expanded:text-ink",
        destructive:
          "bg-danger-soft text-danger hover:bg-danger hover:text-on-brand",
        link: "rounded-sm px-0! text-brand-text underline-offset-4 hover:underline",
        inverse: "bg-ink text-ink-inverse hover:bg-ink/85",
      },
      size: {
        default:
          "h-(--control-h) gap-2 px-3 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-(--control-h-sm) gap-1.5 px-2.5 text-[0.8125rem] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        lg: "h-(--control-h-lg) gap-2 px-4 text-sm",
        icon: "size-(--control-h)",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-(--control-h-sm)",
        "icon-lg": "size-(--control-h-lg)",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  // A link rendered through `render` is not a <button>, so Base UI must not expect native button semantics.
  const isNative = nativeButton ?? (render == null || (React.isValidElement(render) && render.type === "button"));
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      render={render}
      nativeButton={isNative}
      {...props} />
  );
}

export { Button, buttonVariants }
