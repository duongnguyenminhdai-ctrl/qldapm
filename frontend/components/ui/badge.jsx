import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#c3a47b] text-[#161311] font-semibold shadow-xs",
        secondary: "border-stone-300 bg-[#EAE3D5] text-[#2D241E] dark:border-[#3a3128] dark:bg-[#201b18] dark:text-[#d8c8b4]",
        outline: "border-stone-300 text-[#2D241E] bg-[#FAF8F5]/80 dark:border-[#3a3128] dark:text-[#d8c8b4] dark:bg-[#181513]/60",
        muted: "border-transparent bg-stone-200 text-[#615247] dark:bg-[#26201c] dark:text-[#a89b8d]",
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
