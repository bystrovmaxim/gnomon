// web/app/[org]/page.tsx — the root node "Notes": opened at /w/<org>/notes in Maxitor's right panel.
import { PanelPage } from "@maxitor/panel";

export default function NotesHome() {
  return (
    <PanelPage title="Notes">
      <p>Notes live on items: open an item under Notes in the tree and choose Notes under it.</p>
    </PanelPage>
  );
}
