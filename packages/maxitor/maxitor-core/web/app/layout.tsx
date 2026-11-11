// packages/maxitor/maxitor-core/web/app/layout.tsx
// Every page of the core: Maxitor's tokens, the stylesheet of the mockup and the cookie banner.
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@maxitor/tokens/tokens.css";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";

export const metadata: Metadata = { title: "Maxitor", description: "Maxitor — sign in and work in your organizations" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** The version of the privacy policy the banner's answer is kept for. */
const POLICY_VERSION = process.env.MAXITOR_POLICY_VERSION ?? "1";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieBanner version={POLICY_VERSION} />
      </body>
    </html>
  );
}
