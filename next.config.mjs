/** @type {import('next').NextConfig} */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

function gitInfo() {
  try {
    const short = execSync("git rev-parse --short HEAD", { cwd: __dirname }).toString().trim();
    const full = execSync("git rev-parse HEAD", { cwd: __dirname }).toString().trim();
    return { short, full };
  } catch {
    return { short: "unknown", full: "unknown" };
  }
}

const git = gitInfo();

function contentSecurityPolicy() {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval' blob:"
    : "'self' 'unsafe-inline'";
  let policy =
    "default-src 'self'; " +
    `script-src ${scriptSrc}; ` +
    "style-src 'self' 'unsafe-inline'; " +
    "connect-src 'self' ws://localhost:* wss://localhost:* ws://127.0.0.1:* wss://127.0.0.1:* https://api.openai.com https://api.anthropic.com https://api.groq.com https://api.deepseek.com https://api.together.xyz https://api.mistral.ai https://generativelanguage.googleapis.com https://gateway.ai.cloudflare.com https://*.amazonaws.com https://*.posthog.com; " +
    "img-src 'self' data:; " +
    "font-src 'self' data:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'none'; " +
    "frame-ancestors 'none'";
  if (isDev) {
    policy += "; worker-src 'self' blob:";
  }
  return policy;
}

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: __dirname,
  env: {
    NEXT_PUBLIC_APP_VERSION: typeof pkg.version === "string" ? pkg.version : "0.0.0-dev",
    NEXT_PUBLIC_GIT_COMMIT: git.short,
    NEXT_PUBLIC_GIT_COMMIT_FULL: git.full,
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
  },
  reactStrictMode: false,
  outputFileTracingIncludes: {
    "**/*": ["node_modules/ws/**/*", "node_modules/ssh2/**/*", "node_modules/next/**/*"],
  },
  // Next.js 16 defaults production builds to Turbopack; opt in explicitly alongside webpack (used in dev watch options).
  turbopack: {},
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy() }],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      if (!config.watchOptions) {
        config.watchOptions = {};
      }
      config.watchOptions.ignored = [
        ...(Array.isArray(config.watchOptions.ignored) ? config.watchOptions.ignored : []),
        "**/database.sqlite",
        "**/database.sqlite-*",
      ];
    }
    return config;
  },
};

export default nextConfig;
