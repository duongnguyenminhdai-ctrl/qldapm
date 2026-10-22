import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(
  ({ className, type = "text", label, id, hint, error, ...props }, ref) => {
    return (
      <div className="flex w-full flex-col gap-2">
        {label ? (
          <label htmlFor={id} className="text-sm font-medium text-[#2D241E] dark:text-[#f5ede3]">
            {label}
          </label>
        ) : null}
        <input
          id={id}
          type={type}
          className={cn(
            "flex h-10 w-full rounded-lg border border-stone-300 bg-[#FAF8F5] px-3 py-2 text-sm text-[#2D241E] shadow-sm",
            "placeholder:text-stone-400 focus-visible:ring-[#b3894e] focus-visible:border-[#b3894e]",
            "dark:border-[#3a3128] dark:bg-[#141210] dark:text-[#f5ede3] dark:placeholder:text-[#75695e] dark:focus-visible:ring-[#c3a47b] dark:focus-visible:border-[#c3a47b]",
            "transition duration-taste ease-taste",
            "focus-visible:outline-none focus-visible:ring-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-rose-500/80 focus-visible:ring-rose-500/50",
            className
          )}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          {...props}
        />
        {hint && !error ? (
          <p id={`${id}-hint`} className="text-xs text-stone-500 dark:text-[#75695e]">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} className="text-xs text-rose-400">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
