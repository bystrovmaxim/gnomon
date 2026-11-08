// web/app/page.tsx — the root node "Notes": opened at /w/notes in Maxitor's right panel.
import { PanelPage } from "@maxitor/panel";

export default function NotesHome() {
  return (
    <PanelPage title="Notes">
      <p>Notes live on catalog items: open an item in the tree and choose Notes under it.</p>
    </PanelPage>
  );
}
