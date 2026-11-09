// packages/maxitor/maxitor-core/web/next.config.ts
// The core's application: its pages here, every other /api/** address passed to the core's backend.
import type { NextConfig } from "next";

const backend = process.env.MAXITOR_CORE_API ?? "http://127.0.0.1:8020";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // A server action's arguments include passwords: the development terminal never prints them.
  logging: { serverFunctions: false },
  async rewrites() {
    // After the application's own routes: the sign-in start and callback stay here, the rest goes to the backend.
    return { beforeFiles: [], afterFiles: [{ source: "/api/:path*", destination: `${backend}/api/:path*` }], fallback: [] };
  },
};

export default config;
