import { KeyIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import {
  KeyIcon as KeyIconSolid,
  LockClosedIcon as LockClosedIconSolid,
} from "@heroicons/react/24/solid";
import type { AuthType } from "@/lib/types";

const AUTH_METHODS = [
  {
    value: "password" as const,
    label: "Password",
    Outline: LockClosedIcon,
    Solid: LockClosedIconSolid,
  },
  { value: "privateKey" as const, label: "Private key", Outline: KeyIcon, Solid: KeyIconSolid },
] as const satisfies ReadonlyArray<{
  value: AuthType;
  label: string;
  Outline: typeof LockClosedIcon | typeof KeyIcon;
  Solid: typeof LockClosedIconSolid | typeof KeyIconSolid;
}>;

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
        const Icon = active ? method.Solid : method.Outline;

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
            <Icon className="w-[13px] h-[13px] shrink-0" />
            {method.label}
          </button>
        );
      })}
    </div>
  );
}
