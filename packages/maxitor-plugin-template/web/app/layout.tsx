// web/app/layout.tsx — the document of a page shown in Maxitor's right panel.
// No header, menu or background of its own: Maxitor draws the frame and the grey dotted field under the panel, and
// each page draws its controls in the shell of @maxitor/panel. PanelDocument makes the page transparent, gives it Maxitor's tokens and speaks the panel protocol.
import type { ReactNode } from "react";
import { PanelDocument } from "@maxitor/panel";

import { version } from "../package.json";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <PanelDocument build={version}>{children}</PanelDocument>;
}
