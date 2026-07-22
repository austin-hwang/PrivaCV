"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ToggleButton as TogglePrimitive, type ToggleButtonProps } from "react-aria-components";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 dark:aria-invalid:ring-destructive/40 data-selected:border-primary data-selected:bg-primary data-selected:text-primary-foreground data-selected:hover:bg-primary/90 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-muted",
        subtle:
          "border border-transparent bg-transparent hover:bg-muted aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-foreground aria-pressed:hover:bg-primary/15 data-[state=on]:border-primary/40 data-[state=on]:bg-primary/10 data-[state=on]:text-foreground data-[state=on]:hover:bg-primary/15 data-selected:border-primary/40 data-selected:bg-primary/10 data-selected:text-foreground data-selected:hover:bg-primary/15",
      },
      size: {
        default:
          "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  title,
  ref: forwardedRef,
  ...props
}: Omit<ToggleButtonProps, "className"> &
  React.RefAttributes<HTMLButtonElement> &
  VariantProps<typeof toggleVariants> & {
    className?: string;
    title?: string;
  }) {
  const innerRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    if (title != null) node.setAttribute("title", title);
    else node.removeAttribute("title");
  }, [title]);
  const setRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );
  return (
    <TogglePrimitive
      ref={setRef}
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
