// web/next.config.ts — the plugin's frontend lives under /p/notes and ships as a standalone build.
import type { NextConfig } from "next";

const config: NextConfig = {
  // Maxitor's gateway sends /p/notes/** here; the page is shown only inside Maxitor's right panel.
  basePath: "/p/notes",
  // A server.js with only the files it needs: the build travels inside the wheel, and Next.js is not built on the server.
  output: "standalone",
  // @maxitor/panel and @maxitor/tokens ship their TypeScript and CSS; the build compiles them with the page.
  transpilePackages: ["@maxitor/panel", "@maxitor/tokens"],
};

export default config;
