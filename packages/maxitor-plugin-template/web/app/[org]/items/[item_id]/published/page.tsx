// web/app/[org]/items/[item_id]/published/page.tsx — the published notes of an item, opened at
// /w/<org>/notes/items/<item_id>/published. What the revision in force holds comes with the template's pages (#102).
import { Card, PanelPage } from "@maxitor/panel";

export default function PublishedNotesPage() {
  return (
    <PanelPage history={{ milestones: "list_note_history", card: "note_milestone_card" }} title="Published notes">
      <Card>The notes of the item's last published revision, with its number, title and comment, will be here.</Card>
    </PanelPage>
  );
}
