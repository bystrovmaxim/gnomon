// packages/maxitor/maxitor-core/web/next.config.ts
// The core's application: its pages here, every other /api/** address passed to the core's backend.
import type { NextConfig } from "next";

const backend = process.env.MAXITOR_CORE_API ?? "http://127.0.0.1:8020";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Maxitor's own packages ship their TypeScript and CSS; the application compiles them with its own code.
  transpilePackages: ["@maxitor/panel", "@maxitor/tokens"],
  // A server action's arguments include passwords: the development terminal never prints them.
  logging: { serverFunctions: false },
  // A private plugin's wheel is uploaded through a server action: at most 50 MB, about 67 MB in base64.
  experimental: { serverActions: { bodySizeLimit: "70mb" } },
  async redirects() {
    // The core's own pages live under /w/<code>/core/ (spec 077): the address Settings → Plugins had before leads there.
    return [{ source: "/w/:code/settings/plugins", destination: "/w/:code/core/settings/plugins", permanent: true }];
  },
  async rewrites() {
    // After every route of the application, its dynamic ones too (the sign-in's start and callback): only an address
    // the application does not serve goes to the backend. An afterFiles rewrite would come before the dynamic routes.
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/api/:path*", destination: `${backend}/api/:path*` }] };
  },
};

export default config;
