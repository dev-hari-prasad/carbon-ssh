import darkVs from "./dark_vs.json";
import darkPlus from "./dark_plus.json";
import darkModern from "./dark_modern.json";
import lightVs from "./light_vs.json";
import lightPlus from "./light_plus.json";
import lightModern from "./light_modern.json";
import hcBlack from "./hc_black.json";
import hcLight from "./hc_light.json";
import theme2026Light from "./2026-light.json";
import solarizedLight from "./solarized-light-color-theme.json";
import oneDarkProNightFlat from "./OneDark-Pro-night-flat.json";


export const DEFAULT_THEME_ID = "dark_modern";
export const RECOMMENDED_THEME_IDS = [
  "dark_modern",
  "2026-light",
  "light_modern",
  "onedark-pro-night-flat",
];

type RawTheme = {
  name?: string;
  type?: "dark" | "light" | string;
  include?: string;
  colors?: Record<string, string>;
  tokenColors?: unknown[];
  semanticHighlighting?: boolean;
  semanticTokenColors?: Record<string, unknown>;
};

export type AppTheme = {
  id: string;
  name: string;
  type: "dark" | "light";
  colors: Record<string, string>;
  syntax: Record<string, string>;
};

const entries: Array<{ id: string; file: string; raw: RawTheme }> = [
  { id: "2026-light", file: "2026-light.json", raw: theme2026Light },
  { id: "dark_modern", file: "dark_modern.json", raw: darkModern },
  { id: "dark_plus", file: "dark_plus.json", raw: darkPlus },
  { id: "dark_vs", file: "dark_vs.json", raw: darkVs },
  { id: "hc_black", file: "hc_black.json", raw: hcBlack },
  { id: "hc_light", file: "hc_light.json", raw: hcLight },
  { id: "light_modern", file: "light_modern.json", raw: lightModern },
  { id: "light_plus", file: "light_plus.json", raw: lightPlus },
  { id: "light_vs", file: "light_vs.json", raw: lightVs },
  {
    id: "onedark-pro-night-flat",
    file: "OneDark-Pro-night-flat.json",
    raw: oneDarkProNightFlat,
  },
  { id: "solarized-light", file: "solarized-light-color-theme.json", raw: solarizedLight },

];

const byFile = new Map(entries.map((entry) => [entry.file.toLowerCase(), entry]));
const nameOverrides: Record<string, string> = {
  dark_modern: "Dark Modern (default)",
  "2026-light": "2026 Light (default)",
  "onedark-pro-night-flat": "One Dark Pro Night Flat",
};


function includeFile(path: string) {
  return path.replace(/^\.\//, "").toLowerCase();
}

function inferType(raw: RawTheme, colors: Record<string, string>): "dark" | "light" {
  if (raw.type === "light") return "light";
  if (raw.type === "dark") return "dark";
  const background = colors["editor.background"] ?? "";
  return background.toLowerCase() === "#ffffff" || raw.name?.toLowerCase().includes("light")
    ? "light"
    : "dark";
}

function extractSyntaxColors(
  raw: RawTheme,
  baseSyntax?: Record<string, string>,
): Record<string, string> {
  const syntax: Record<string, string> = { ...baseSyntax };

  if (Array.isArray(raw.tokenColors)) {
    for (const token of raw.tokenColors) {
      if (
        !token ||
        typeof token !== "object" ||
        !("settings" in token) ||
        !token.settings ||
        typeof token.settings !== "object" ||
        !("foreground" in token.settings) ||
        typeof token.settings.foreground !== "string"
      ) {
        continue;
      }
      
      const fg = token.settings.foreground;
      const scopeRaw = (token as { scope?: unknown }).scope;
      const scopes: string[] = Array.isArray(scopeRaw)
        ? scopeRaw.filter((s): s is string => typeof s === "string")
        : typeof scopeRaw === "string"
          ? scopeRaw.split(",").map((s) => s.trim())
          : [];

      for (const scope of scopes) {
        if (scope === "comment" || scope.startsWith("comment.")) syntax.comment = fg;
        else if (scope === "string" || scope.startsWith("string.")) syntax.string = fg;
        else if (scope === "keyword" || scope.startsWith("keyword.")) syntax.keyword = fg;
        else if (scope === "entity.name.function" || scope.startsWith("entity.name.function.")) syntax.function = fg;
        else if (scope === "variable" || scope.startsWith("variable.")) syntax.variable = fg;
        else if (scope === "constant" || scope.startsWith("constant.")) syntax.constant = fg;
        else if (scope === "entity.name.type" || scope.startsWith("entity.name.type.")) syntax.type = fg;
        else if (scope === "support.type.property-name" || scope.startsWith("support.type.property-name.") || scope.startsWith("variable.other.property")) syntax.property = fg;
      }
    }
  }

  return syntax;
}

function resolveTheme(
  entry: { id: string; file: string; raw: RawTheme },
  seen = new Set<string>(),
): AppTheme {
  if (seen.has(entry.file)) {
    return {
      id: entry.id,
      name: entry.raw.name ?? entry.id,
      type: inferType(entry.raw, entry.raw.colors ?? {}),
      colors: entry.raw.colors ?? {},
      syntax: extractSyntaxColors(entry.raw),
    };
  }

  seen.add(entry.file);
  const base = entry.raw.include ? byFile.get(includeFile(entry.raw.include)) : undefined;
  const baseTheme = base ? resolveTheme(base, seen) : undefined;
  const colors = { ...(baseTheme?.colors ?? {}), ...(entry.raw.colors ?? {}) };
  const syntax = extractSyntaxColors(entry.raw, baseTheme?.syntax);

  return {
    id: entry.id,
    name: nameOverrides[entry.id] ?? entry.raw.name ?? entry.id,
    type: inferType(entry.raw, colors),
    colors,
    syntax,
  };
}

const VISIBLE_THEME_IDS = new Set([
  "2026-light",
  "light_modern",
  "hc_light",
  "solarized-light",
  "dark_modern",
  "onedark-pro-night-flat",
  "hc_black",

  "dark_plus",
]);

export const THEMES: AppTheme[] = entries
  .filter((entry) => VISIBLE_THEME_IDS.has(entry.id))
  .map((entry) => resolveTheme(entry))
  .sort((a, b) => a.name.localeCompare(b.name));


export function getThemeById(id: string): AppTheme {
  return (
    THEMES.find((theme) => theme.id === id) ??
    THEMES.find((theme) => theme.id === DEFAULT_THEME_ID) ??
    THEMES[0]
  );
}

function color(colors: Record<string, string>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = colors[key];
    if (value) return value;
  }
  return fallback;
}

/** Hex/rgb(a) → "#rrggbb" lowercase for equality checks. Returns null on parse fail. */
function normalizeHex(c: string): string | null {
  if (typeof c !== "string") return null;
  const t = c.trim().toLowerCase();
  if (/^#[0-9a-f]{8}$/.test(t)) return t.slice(0, 7);
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  if (/^#[0-9a-f]{4}$/.test(t)) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  }
  if (/^#[0-9a-f]{3}$/.test(t)) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  }
  const m = t.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(",").map((s) => s.trim());
    if (parts.length >= 3) {
      const toHex = (v: string) => {
        const n = Math.max(0, Math.min(255, parseInt(v, 10) || 0));
        return n.toString(16).padStart(2, "0");
      };
      return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`;
    }
  }
  return null;
}

/**
 * Pick the first candidate color whose value is visibly different from `against`
 * (the background). Falls back to the first non-empty value, then `fallback`.
 * Guards against themes (e.g. One Dark Pro Flat) where `focusBorder` is set to
 * the editor background, which would produce an invisible accent.
 */
function visibleColor(
  colors: Record<string, string>,
  keys: string[],
  against: string,
  fallback: string,
): string {
  const againstHex = normalizeHex(against);
  for (const key of keys) {
    const value = colors[key];
    if (!value) continue;
    const hex = normalizeHex(value);
    // Accept the candidate unless we can prove it's the same color as the
    // background (or fully transparent, which renders identical to bg).
    if (!hex || !againstHex) return value;
    if (hex === againstHex) continue;
    // Reject fully transparent values (e.g. "#00000000" on hc_black).
    if (/^#[0-9a-f]{6}00$/i.test(value.trim())) continue;
    return value;
  }
  return fallback;
}

function opaque(c: string): string {
  if (typeof c !== "string") return c;
  const trimmed = c.trim();
  // #RRGGBBAA -> #RRGGBB
  if (/^#[0-9a-f]{8}$/i.test(trimmed)) return trimmed.slice(0, 7);
  // #RGBA -> #RGB
  if (/^#[0-9a-f]{4}$/i.test(trimmed)) return trimmed.slice(0, 4);
  // rgba(r,g,b,a) -> rgb(r,g,b)
  const m = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(",").map((s) => s.trim());
    if (parts.length >= 3) return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  }
  return trimmed;
}

export function cssVariablesForTheme(theme: AppTheme): Record<string, string> {
  const c = theme.colors;
  const dark = theme.type === "dark";
  const editorBg = opaque(color(c, ["editor.background"], dark ? "#1e1e1e" : "#ffffff"));
  const editorFg = opaque(
    color(c, ["editor.foreground", "foreground"], dark ? "#cccccc" : "#1f1f1f"),
  );
  const panelBg = opaque(
    color(
      c,
      ["panel.background", "sideBar.background", "editorGroupHeader.tabsBackground"],
      dark ? "#181818" : "#f3f3f3",
    ),
  );
  const titleBg = opaque(
    color(
      c,
      ["titleBar.activeBackground", "commandCenter.background", "sideBar.background"],
      dark ? "#181818" : "#dddddd",
    ),
  );
  const accent = visibleColor(
    c,
    [
      "focusBorder",
      "button.background",
      "activityBarBadge.background",
      "progressBar.background",
      "statusBarItem.remoteBackground",
    ],
    editorBg,
    "#007acc",
  );
  const commandBg = opaque(
    color(
      c,
      [
        "commandCenter.background",
        "quickInput.background",
        "input.background",
        "dropdown.background",
      ],
      dark ? "#3c3c3c" : "#ffffff",
    ),
  );

  return {
    "--bg": editorBg,
    "--bg-elev": color(
      c,
      ["quickInput.background", "editorWidget.background", "menu.background", "sideBar.background"],
      dark ? "#252526" : "#f3f3f3",
    ),
    "--bg-panel": panelBg,
    "--fg": editorFg,
    "--fg-muted": color(
      c,
      [
        "descriptionForeground",
        "sideBar.foreground",
        "input.placeholderForeground",
        "titleBar.inactiveForeground",
      ],
      dark ? "#a7a7a7" : "#616161",
    ),
    "--fg-dim": color(
      c,
      ["disabledForeground", "editorLineNumber.foreground"],
      dark ? "#6f6f6f" : "#767676",
    ),
    "--border": `color-mix(in oklab, ${color(c, ["panel.border", "sideBar.border", "editorGroupHeader.tabsBorder", "tab.border", "widget.border"], dark ? "#2d2d30" : "#d4d4d4")} 45%, ${editorBg})`,
    "--border-strong": `color-mix(in oklab, ${visibleColor(c, ["input.border", "focusBorder", "editorGroup.border"], editorBg, dark ? "#3c3c3c" : "#919191")} 65%, ${editorBg})`,
    "--accent": accent,
    "--accent-fg": color(c, ["button.foreground", "activityBarBadge.foreground"], "#ffffff"),
    "--accent-soft": color(
      c,
      [
        "quickInputList.focusBackground",
        "list.activeSelectionBackground",
        "list.focusBackground",
        "editor.selectionBackground",
      ],
      dark ? "#094771" : "#cce8ff",
    ),
    "--success": color(
      c,
      ["gitDecoration.addedResourceForeground", "terminal.ansiGreen"],
      "#89d185",
    ),
    "--danger": color(
      c,
      ["errorForeground", "gitDecoration.deletedResourceForeground", "terminal.ansiRed"],
      "#f48771",
    ),
    "--warning": color(
      c,
      ["list.warningForeground", "gitDecoration.modifiedResourceForeground", "terminal.ansiYellow"],
      "#cca700",
    ),
    "--titlebar-bg": titleBg,
    "--titlebar-fg": color(
      c,
      ["titleBar.activeForeground", "commandCenter.foreground", "foreground", "editor.foreground"],
      editorFg,
    ),
    "--titlebar-border": `color-mix(in oklab, ${color(c, ["titleBar.border", "sideBar.border", "panel.border"], dark ? "#2b2b2b" : "#d4d4d4")} 45%, ${titleBg})`,
    "--command-bg": commandBg,
    "--tab-strip-active-bg": `color-mix(in oklab, ${commandBg} ${dark ? "74%" : "92%"}, black)`,
    "--command-active-bg": color(
      c,
      [
        "commandCenter.activeBackground",
        "quickInputList.focusBackground",
        "list.hoverBackground",
        "input.background",
      ],
      dark ? "#505050" : "#f3f3f3",
    ),
    "--tabs-bg": color(c, ["editorGroupHeader.tabsBackground", "panel.background"], panelBg),
    "--tab-active-bg": color(
      c,
      ["tab.activeBackground", "tab.selectedBackground", "editor.background"],
      editorBg,
    ),
    "--tab-inactive-bg": color(
      c,
      ["tab.inactiveBackground", "editorGroupHeader.tabsBackground"],
      panelBg,
    ),
    "--tab-hover-bg": color(
      c,
      ["tab.hoverBackground", "list.hoverBackground"],
      dark ? "#333333" : "#e8e8e8",
    ),
    "--input-bg": color(
      c,
      ["input.background", "settings.textInputBackground"],
      dark ? "#1f1f1f" : "#ffffff",
    ),
    "--button-bg": color(c, ["button.background"], accent),
    "--button-hover-bg": color(c, ["button.hoverBackground"], accent),
    "--menu-bg": color(
      c,
      ["quickInput.background", "menu.background", "editorWidget.background"],
      panelBg,
    ),
    "--menu-hover-bg": color(
      c,
      ["list.hoverBackground", "menu.selectionBackground"],
      dark ? "#2a2d2e" : "#e8e8e8",
    ),
    "--sidebar-bg": color(
      c,
      ["sideBar.background", "panel.background", "editorGroupHeader.tabsBackground"],
      dark ? "#181818" : "#f3f3f3",
    ),
    "--popover-bg": opaque(
      color(
        c,
        [
          "editorWidget.background",
          "menu.background",
          "quickInput.background",
          "dropdown.background",
          "sideBar.background",
        ],
        dark ? "#252526" : "#ffffff",
      ),
    ),
    "--neutral-hover-bg": dark
      ? `color-mix(in oklab, ${editorFg} 8%, transparent)`
      : `color-mix(in oklab, ${editorFg} 6%, transparent)`,
    "--syntax-comment": theme.syntax.comment ?? (dark ? "#6a9955" : "#008000"),
    "--syntax-string": theme.syntax.string ?? (dark ? "#ce9178" : "#a31515"),
    "--syntax-keyword": theme.syntax.keyword ?? (dark ? "#569cd6" : "#0000ff"),
    "--syntax-function": theme.syntax.function ?? (dark ? "#dcdcaa" : "#795e26"),
    "--syntax-variable": theme.syntax.variable ?? (dark ? "#9cdcfe" : "#001080"),
    "--syntax-constant": theme.syntax.constant ?? (dark ? "#b5cea8" : "#098658"),
    "--syntax-type": theme.syntax.type ?? (dark ? "#4ec9b0" : "#267f99"),
    "--syntax-property": theme.syntax.property ?? (dark ? "#9cdcfe" : "#001080"),
  };
}

export function terminalThemeForTheme(theme: AppTheme) {
  const c = theme.colors;
  return {
    background: color(
      c,
      ["terminal.background", "editor.background"],
      theme.type === "dark" ? "#1e1e1e" : "#ffffff",
    ),
    foreground: color(
      c,
      ["terminal.foreground", "editor.foreground", "foreground"],
      theme.type === "dark" ? "#cccccc" : "#333333",
    ),
    cursor: color(
      c,
      ["terminalCursor.foreground", "editorCursor.foreground"],
      theme.type === "dark" ? "#aeafad" : "#000000",
    ),
    cursorAccent: color(
      c,
      ["terminalCursor.background", "editor.background"],
      theme.type === "dark" ? "#1e1e1e" : "#ffffff",
    ),
    selectionBackground: color(
      c,
      ["terminal.selectionBackground", "editor.selectionBackground"],
      theme.type === "dark" ? "#264f78" : "#add6ff",
    ),
    black: color(c, ["terminal.ansiBlack"], "#000000"),
    red: color(c, ["terminal.ansiRed"], "#cd3131"),
    green: color(c, ["terminal.ansiGreen"], "#0dbc79"),
    yellow: color(c, ["terminal.ansiYellow"], "#e5e510"),
    blue: color(c, ["terminal.ansiBlue"], "#2472c8"),
    magenta: color(c, ["terminal.ansiMagenta"], "#bc3fbc"),
    cyan: color(c, ["terminal.ansiCyan"], "#11a8cd"),
    white: color(c, ["terminal.ansiWhite"], "#e5e5e5"),
    brightBlack: color(c, ["terminal.ansiBrightBlack"], "#666666"),
    brightRed: color(c, ["terminal.ansiBrightRed"], "#f14c4c"),
    brightGreen: color(c, ["terminal.ansiBrightGreen"], "#23d18b"),
    brightYellow: color(c, ["terminal.ansiBrightYellow"], "#f5f543"),
    brightBlue: color(c, ["terminal.ansiBrightBlue"], "#3b8eea"),
    brightMagenta: color(c, ["terminal.ansiBrightMagenta"], "#d670d6"),
    brightCyan: color(c, ["terminal.ansiBrightCyan"], "#29b8db"),
    brightWhite: color(c, ["terminal.ansiBrightWhite"], "#ffffff"),
  };
}
