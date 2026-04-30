import { THEMES, cssVariablesForTheme } from "@/config/themes";

/** Precomputed for the blocking theme bootstrap script in `layout.tsx`. */
export const THEME_VARS_BY_ID: Record<string, Record<string, string>> = Object.fromEntries(
  THEMES.map((t) => [t.id, cssVariablesForTheme(t)]),
);
