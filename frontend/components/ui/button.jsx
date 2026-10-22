import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition duration-taste ease-taste focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c3a47b] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#c3a47b] text-[#161311] hover:bg-[#d6b88f] shadow-sm font-semibold",
        destructive:
          "bg-[#8b2626] text-[#f5ede3] hover:bg-[#a63030] border border-[#a63030]/40",
        outline:
          "border border-stone-300 dark:border-[#3a3128] bg-transparent text-[#2D241E] dark:text-[#d8c8b4] hover:bg-stone-200/60 dark:hover:bg-[#26201c] hover:text-[#2D241E] dark:hover:text-[#f5ede3]",
        secondary:
          "bg-[#EAE3D5] dark:bg-[#201b18] text-[#2D241E] dark:text-[#d8c8b4] border border-stone-300 dark:border-[#3a3128] hover:bg-stone-200 dark:hover:bg-[#29231f] hover:text-[#2D241E] dark:hover:text-[#f5ede3]",
        ghost:
          "text-[#615247] dark:text-[#a89b8d] hover:bg-stone-200/60 dark:hover:bg-[#26201c] hover:text-[#2D241E] dark:hover:text-[#f5ede3]",
        link: "text-[#c3a47b] underline-offset-4 hover:underline",
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
