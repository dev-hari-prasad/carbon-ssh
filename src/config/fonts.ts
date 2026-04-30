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

export const DEFAULT_FONT_ID = "manrope";

export function getFontById(id: string): AppFont {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}
