import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-zinc-100 text-zinc-950",
        secondary: "border-zinc-800/60 bg-zinc-900 text-zinc-300",
        outline: "border-zinc-800/60 text-zinc-400",
        muted: "border-transparent bg-zinc-800/60 text-zinc-400",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
