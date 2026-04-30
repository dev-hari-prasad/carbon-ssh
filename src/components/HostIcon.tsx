import { BRAND_ICON_MAP } from "@/features/connections/brandIcons";
import { SYSTEM_ICONS } from "@/features/connections/IconPicker";
import type { Connection } from "@/lib/types";

export function HostIcon({ conn, size = 36 }: { conn: Connection; size?: number }) {
  const brand = conn.iconBrand ? BRAND_ICON_MAP[conn.iconBrand] : null;
  const iconSize = Math.round(size * 0.5);

  if (brand) {
    const BrandIcon = brand.Icon;
    return (
      <div
        className="shrink-0 grid place-items-center"
        style={{
          width: size,
          height: size,
        }}
      >
        <BrandIcon width={size} height={size} />
      </div>
    );
  }

  const color = conn.iconColor ?? "var(--accent)";
  const sys = SYSTEM_ICONS.find(s => s.id === conn.iconKind) || SYSTEM_ICONS[0];
  const Icon = sys.Icon;
  
  return (
    <div
      className="shrink-0 rounded-full grid place-items-center text-white shadow-inner"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, color-mix(in oklab, ${color} 70%, white), ${color} 65%)`,
      }}
    >
      <Icon size={iconSize} weight="fill" />
    </div>
  );
}
