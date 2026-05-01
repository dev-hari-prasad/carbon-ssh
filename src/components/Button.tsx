import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-1.5 font-medium font-sans rounded-[8px] transition-colors duration-100 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent select-none";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--button-bg)] text-accent-fg hover:bg-[var(--button-hover-bg)]",
  ghost: "text-fg-muted hover:text-fg hover:bg-bg-elev",
  outline: "border border-border text-fg hover:border-border-strong hover:bg-bg-elev",
  danger: "text-danger hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-8 px-3 text-[13px]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "outline", size = "md", className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  );
});
