"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-signal text-white border-signal hover:bg-signal-ink hover:border-signal-ink disabled:bg-ink-4 disabled:border-ink-4",
  secondary:
    "bg-paper text-ink border-rule-strong hover:border-ink-3 hover:bg-paper-2 disabled:text-ink-4",
  ghost:
    "bg-transparent text-ink-2 border-transparent hover:bg-paper-2 hover:text-ink disabled:text-ink-4",
  danger:
    "bg-paper text-danger border-rule-strong hover:bg-danger-wash hover:border-danger disabled:text-ink-4",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", loading, icon, children, className = "", disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center border rounded-[2px] font-medium
        transition-[background-color,border-color,color] duration-150
        disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  );
});

/** Same visual vocabulary as Button, but renders an anchor. Keeping these in
 *  one file is what stops the two drifting apart. */
export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  icon,
  children,
  className = "",
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center border rounded-[2px] font-medium no-underline
        transition-[background-color,border-color,color] duration-150
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {icon}
      {children}
    </Link>
  );
}
