import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition duration-taste ease-taste focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white shadow-sm",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700/90 dark:text-zinc-50 dark:hover:bg-rose-700",
        outline:
          "border border-zinc-200/90 bg-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
        secondary:
          "bg-zinc-100 text-zinc-900 border border-zinc-200/80 hover:bg-zinc-200/70 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800/60 dark:hover:bg-zinc-800",
        ghost:
          "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
        link: "text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 px-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
