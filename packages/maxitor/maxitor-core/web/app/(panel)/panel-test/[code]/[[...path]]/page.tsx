// packages/maxitor/maxitor-core/web/app/(panel)/panel-test/[code]/[[...path]]/page.tsx
// The panel's test page (spec 077, FR-029): a page of the core drawn with @maxitor/panel in the right panel's frame,
// as a plugin's page is, so the protocol, the canvas and the controls are checked without any plugin. It shows what
// it was told and asks for every change a page may ask for.
import { TestPage } from "./TestPage";

export default function PanelTestPage() {
  return <TestPage />;
}
