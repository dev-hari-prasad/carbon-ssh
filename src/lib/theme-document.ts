import { cssVariablesForTheme, getThemeById } from "@/config/themes";
import type { ThemeId } from "@/lib/types";

const RUNTIME_STYLE_ID = "theme-vars-runtime";

export function applyThemeToDocument(t: ThemeId) {
  if (typeof document === "undefined") return;
  const theme = getThemeById(t);
  const vars = cssVariablesForTheme(theme);

  const decls = Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  const cssText = `:root{${decls}}`;

  // Update the SSR-rendered base element if it's still around (so the
  // initial blocking paint stays correct after a hydration mismatch).
  const ssrEl = document.getElementById("theme-vars") as HTMLStyleElement | null;
  if (ssrEl) ssrEl.textContent = cssText;

  // Also write to a dedicated runtime element appended last in <head>. This
  // guarantees the latest theme always wins via cascade order, regardless of
  // anything React 19 / Next 16 might do to the SSR-managed <style> on
  // hydration or fast refresh.
  let runtimeEl = document.getElementById(RUNTIME_STYLE_ID) as HTMLStyleElement | null;
  if (!runtimeEl) {
    runtimeEl = document.createElement("style");
    runtimeEl.id = RUNTIME_STYLE_ID;
    document.head.appendChild(runtimeEl);
  } else if (
    runtimeEl.parentNode !== document.head ||
    runtimeEl !== document.head.lastElementChild
  ) {
    // Re-append to keep it last so later-inserted stylesheets can't shadow it.
    document.head.appendChild(runtimeEl);
  }
  runtimeEl.textContent = cssText;

  const root = document.documentElement;
  root.classList.toggle("light", theme.type === "light");
  root.classList.toggle("dark", theme.type === "dark");
  root.setAttribute("data-theme", theme.id);
}
