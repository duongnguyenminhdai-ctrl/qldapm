import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Ghép className Tailwind an toàn (shadcn/ui).
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
