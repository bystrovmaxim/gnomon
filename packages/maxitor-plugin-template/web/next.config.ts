// web/next.config.ts — the plugin's frontend lives under /p/notes and ships as a standalone build.
import type { NextConfig } from "next";

const config: NextConfig = {
  // Maxitor's gateway sends /p/notes/** here; the page is shown only inside Maxitor's right panel.
  basePath: "/p/notes",
  // A server.js with only the files it needs: the build travels inside the wheel, and Next.js is not built on the server.
  output: "standalone",
};

export default config;
