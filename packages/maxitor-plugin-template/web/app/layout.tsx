// web/app/layout.tsx — the document of a page shown in Maxitor's right panel.
// No header, menu or background of its own: Maxitor draws the frame and the grey dotted field under the panel.
import type { ReactNode } from "react";
import { PanelDocument } from "@maxitor/panel";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <PanelDocument>{children}</PanelDocument>;
}
