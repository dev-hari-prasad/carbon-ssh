import "./fonts.css";
import "@/styles.css";

import { DEFAULT_THEME_ID, THEMES } from "@/config/themes";
import { THEME_VARS_BY_ID } from "@/lib/theme-vars-by-id";
import { SmoothCornersRuntime } from "@/components/SmoothCornersRuntime";
import Script from "next/script";

export const metadata = {
  title: "relay/ssh — local SSH client",
  description: "A fast, minimal, local-first SSH client for developers.",
};

function buildThemeRule(id: string) {
  const vars = THEME_VARS_BY_ID[id] ?? THEME_VARS_BY_ID[DEFAULT_THEME_ID];
  const decls = Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return `:root{${decls}}`;
}

const DEFAULT_RULE = buildThemeRule(DEFAULT_THEME_ID);
const LIGHT_THEME_IDS = THEMES.filter((t) => t.type === "light").map((t) => t.id);

const themeMapJson = JSON.stringify(THEME_VARS_BY_ID).replace(/</g, "\\u003c");
const lightIdsJson = JSON.stringify(LIGHT_THEME_IDS);
const defaultIdJson = JSON.stringify(DEFAULT_THEME_ID);

const themeBootstrap = `
(function (THEME_VARS, LIGHT_IDS, DEFAULT_ID) {
  try {
    var saved = localStorage.getItem("ssh.theme.v1");
    if (saved === "light") saved = "2026-light";
    if (saved === "dark") saved = DEFAULT_ID;
    var id = saved && THEME_VARS[saved] ? saved : DEFAULT_ID;
    var vars = THEME_VARS[id];
    var decls = "";
    for (var k in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, k)) {
        decls += k + ":" + vars[k] + ";";
      }
    }
    var cssText = ":root{" + decls + "}";
    var styleEl = document.getElementById("theme-vars");
    if (styleEl) styleEl.textContent = cssText;
    // Also seed the runtime override style so the saved theme survives any
    // React 19 / Next 16 hydration or fast-refresh re-sync of the SSR <style>.
    var runtimeEl = document.getElementById("theme-vars-runtime");
    if (!runtimeEl) {
      runtimeEl = document.createElement("style");
      runtimeEl.id = "theme-vars-runtime";
      document.head.appendChild(runtimeEl);
    }
    runtimeEl.textContent = cssText;
    var root = document.documentElement;
    var isLight = LIGHT_IDS.indexOf(id) !== -1;
    root.classList.toggle("light", isLight);
    root.classList.toggle("dark", !isLight);
    root.setAttribute("data-theme", id);
  } catch (e) {}
})(${themeMapJson}, ${lightIdsJson}, ${defaultIdJson});
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isDefaultLight = LIGHT_THEME_IDS.includes(DEFAULT_THEME_ID);

  return (
    <html
      lang="en"
      className={isDefaultLight ? "light" : "dark"}
      data-theme={DEFAULT_THEME_ID}
      suppressHydrationWarning
    >
      <head>
        <style
          id="theme-vars"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: DEFAULT_RULE }}
        />
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <SmoothCornersRuntime />
      </body>
    </html>
  );
}
