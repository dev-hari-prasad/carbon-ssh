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
    family: "Manrope",
    stack: `"Manrope", ui-sans-serif, system-ui, sans-serif`,
    category: "sans",
  },
  {
    id: "inter",
    name: "Inter",
    family: "Inter",
    stack: `"Inter", ui-sans-serif, system-ui, sans-serif`,
    category: "sans",
  },
  {
    id: "space-grotesk",
    name: "Space Grotesk",
    family: "Space Grotesk",
    stack: `"Space Grotesk", ui-sans-serif, system-ui, sans-serif`,
    category: "sans",
  },
  {
    id: "geist",
    name: "Geist",
    family: "Geist",
    stack: `"Geist", ui-sans-serif, system-ui, sans-serif`,
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
    name: "JetBrains Mono",
    family: "JetBrains Mono",
    stack: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`,
    category: "mono",
  },
  {
    id: "cascadia-code",
    name: "Cascadia Code",
    family: "Cascadia Code",
    stack: `"Cascadia Code", ui-monospace, SFMono-Regular, Menlo, monospace`,
    category: "mono",
  },
  {
    id: "fira-code",
    name: "Fira Code",
    family: "Fira Code",
    stack: `"Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace`,
    category: "mono",
  },
  {
    id: "google-sans-code",
    name: "Google Sans Code",
    family: "Google Sans Code",
    stack: `"Google Sans Code", ui-monospace, SFMono-Regular, Menlo, monospace`,
    category: "mono",
  },
  {
    id: "source-code-pro",
    name: "Source Code Pro",
    family: "Source Code Pro",
    stack: `"Source Code Pro", ui-monospace, SFMono-Regular, Menlo, monospace`,
    category: "mono",
  },
];

export const DEFAULT_FONT_ID = "manrope";
export const DEFAULT_TERMINAL_FONT_ID = "jetbrains-mono";

export function getFontById(id: string): AppFont {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

export function getTerminalFontById(id: string): AppFont {
  return TERMINAL_FONTS.find((f) => f.id === id) ?? TERMINAL_FONTS[0];
}
