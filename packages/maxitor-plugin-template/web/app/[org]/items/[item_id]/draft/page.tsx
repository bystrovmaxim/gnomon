// web/app/[org]/items/[item_id]/draft/page.tsx — the draft of an item, opened at /w/<org>/notes/items/<item_id>/draft.
// What changed since the last revision, and publishing it, come with the template's pages (#102).
import { Card, PanelPage } from "@maxitor/panel";

export default function DraftPage() {
  return (
    // The draft is a comparison already: it offers one moment only.
    <PanelPage title="Draft" history={{ compare: [] }}>
      <Card>What was added, changed or removed since the last revision, with who and when, will be here.</Card>
    </PanelPage>
  );
}
