import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(
  ({ className, type = "text", label, id, hint, error, ...props }, ref) => {
    return (
      <div className="flex w-full flex-col gap-2">
        {label ? (
          <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </label>
        ) : null}
        <input
          id={id}
          type={type}
          className={cn(
            "flex h-10 w-full rounded-lg border border-zinc-200/90 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm",
            "placeholder:text-zinc-400",
            "dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600",
            "transition duration-taste ease-taste",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-rose-500 focus-visible:ring-rose-500/50 dark:border-rose-700/60 dark:focus-visible:ring-rose-600/50",
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
          <p id={`${id}-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} className="text-xs text-rose-500 dark:text-rose-400">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
