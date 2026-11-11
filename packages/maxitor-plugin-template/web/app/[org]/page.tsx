// web/app/[org]/page.tsx — the root node "Notes": opened at /w/<org>/notes in Maxitor's right panel.
import { EmptyState, PanelPage } from "@maxitor/panel";

export default function NotesHome() {
  return (
    <PanelPage title="Notes">
      <EmptyState title="Pick an item">Notes live on items: open one under Notes in the tree and choose Notes under it.</EmptyState>
    </PanelPage>
  );
}
