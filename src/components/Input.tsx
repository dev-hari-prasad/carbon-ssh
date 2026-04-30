import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

const fieldBase =
  "w-full bg-bg border border-border rounded-md px-2.5 h-8 text-[13px] font-mono text-fg placeholder:text-fg-dim transition-colors focus:outline-none focus:border-accent";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return <input ref={ref} className={`${fieldBase} ${className}`} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`${fieldBase} h-auto py-2 leading-snug resize-y min-h-[88px] ${className}`}
      {...rest}
    />
  );
});

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xxs uppercase font-sans font-semibold text-fg-muted tracking-wider">
          {label}
        </span>
        {hint ? <span className="text-xxs text-fg-dim font-mono">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}
