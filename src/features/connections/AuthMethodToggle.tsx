import { Lock, Key } from "@phosphor-icons/react";
import type { AuthType } from "@/lib/types";

const AUTH_METHODS: Array<{ value: AuthType; label: string; Icon: any }> = [
  { value: "password", label: "Password", Icon: Lock },
  { value: "privateKey", label: "Private key", Icon: Key },
];

export function AuthMethodToggle({
  value,
  onChange,
  className = "",
}: {
  value: AuthType;
  onChange: (value: AuthType) => void;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-1 p-1 bg-[var(--input-bg)] border border-border rounded-sm ${className}`}
    >
      {AUTH_METHODS.map((method) => {
        const active = value === method.value;
        const Icon = method.Icon;

        return (
          <button
            key={method.value}
            type="button"
            onClick={() => onChange(method.value)}
            className={`h-8 flex items-center justify-center gap-1.5 rounded-sm text-[11.5px] font-sans font-medium transition-colors ${
              active
                ? "bg-[var(--command-active-bg)] text-fg shadow-sm"
                : "text-fg-muted hover:text-fg hover:bg-[var(--neutral-hover-bg)]"
            }`}
          >
            <Icon size={13} weight={active ? "fill" : "regular"} />
            {method.label}
          </button>
        );
      })}
    </div>
  );
}
