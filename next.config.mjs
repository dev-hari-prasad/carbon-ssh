/** @type {import('next').NextConfig} */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: typeof pkg.version === "string" ? pkg.version : "0.0.0-dev",
  },
  reactStrictMode: false,
  // Next.js 16 defaults production builds to Turbopack; opt in explicitly alongside webpack (used in dev watch options).
  turbopack: {},
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
