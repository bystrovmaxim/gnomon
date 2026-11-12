// packages/maxitor/maxitor-core/web/app/(panel)/layout.tsx
// The document of the core's own pages that open in the right panel's frame, as a plugin's do: the panel's test page.
// Its route is /panel-test/<code>/<path>, so two segments stand before the page's path.
import { PanelDocument } from "@maxitor/panel";
import type { ReactNode } from "react";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <PanelDocument build="core" prefixSegments={2}>{children}</PanelDocument>;
}
