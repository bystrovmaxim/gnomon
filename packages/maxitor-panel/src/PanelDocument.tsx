// @maxitor/panel — the document of a page in Maxitor's right panel: no header, menu or background of its own, the
// tokens and the panel's styles, and the page's side of the panel protocol.
import { Suspense, type ReactNode } from "react";

import "@maxitor/tokens/tokens.css";
import "./panel.css";
import "./compare/marks.css";
import "./compare/compare.css";
import { PanelProvider } from "./PanelProvider";

export function PanelDocument({
  children,
  build = "",
  prefixSegments = 1,
  lang = "en",
}: {
  children: ReactNode;
  /** The plugin's version, sent with panel.ready. */
  build?: string;
  /** How many segments of the page's route stand before its panel path: one, the organization, for a plugin. */
  prefixSegments?: number;
  lang?: string;
}) {
  return (
    <html lang={lang}>
      <body className="mx-panel-document">
        <Suspense>
          <PanelProvider build={build} prefixSegments={prefixSegments}>
            {children}
          </PanelProvider>
        </Suspense>
      </body>
    </html>
  );
}
