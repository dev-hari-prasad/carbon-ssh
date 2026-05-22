export type AppFont = {
  id: string;
  name: string;
  family: string;
  stack: string;
  category: "sans" | "mono";
};

export const FONTS: AppFont[] = [
  {
    id: "manrope",
    name: "Manrope (default)",
    family: "Manrope Variable",
    stack: `"Manrope Variable", ui-sans-serif, system-ui, sans-serif`,
    category: "sans",
  },
  {
    id: "inter",
    name: "Inter",
    family: "Inter Variable",
    stack: `"Inter Variable", ui-sans-serif, system-ui, sans-serif`,
    category: "sans",
  },
  {
    id: "space-grotesk",
    name: "Space Grotesk",
    family: "Space Grotesk Variable",
    stack: `"Space Grotesk Variable", ui-sans-serif, system-ui, sans-serif`,
    category: "sans",
  },
  {
    id: "system",
    name: "System",
    family: "system-ui",
    stack: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
    category: "sans",
  },
];

export const TERMINAL_FONTS: AppFont[] = [
  {
    id: "jetbrains-mono",
    name: "JetBrains Mono (default)",
    family: "JetBrains Mono Variable",
    stack: `"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace`,
    category: "mono",
  },
  {
    id: "geist-mono",
    name: "Geist Mono",
    family: "Geist Mono Variable",
    stack: `"Geist Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace`,
    category: "mono",
  },
  {
    id: "fira-code",
    name: "Fira Code",
    family: "Fira Code Variable",
    stack: `"Fira Code Variable", ui-monospace, SFMono-Regular, Menlo, monospace`,
    category: "mono",
  },
  {
    id: "source-code-pro",
    name: "Source Code Pro",
    family: "Source Code Pro Variable",
    stack: `"Source Code Pro Variable", ui-monospace, SFMono-Regular, Menlo, monospace`,
    category: "mono",
  },
];

export const DEFAULT_FONT_ID = "manrope";
export const DEFAULT_TERMINAL_FONT_ID = "jetbrains-mono";

export function getFontById(id: string): AppFont {
  const resolved = id === "geist" ? DEFAULT_FONT_ID : id;
  return FONTS.find((f) => f.id === resolved) ?? FONTS[0];
}

export function getTerminalFontById(id: string): AppFont {
  const resolved = id === "google-sans-code" ? "geist-mono" : id;
  return TERMINAL_FONTS.find((f) => f.id === resolved) ?? TERMINAL_FONTS[0];
}
