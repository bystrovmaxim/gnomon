// web/app/[org]/items/[item_id]/published/PublishedView.tsx — Published on the canvas: everyone's notes of the
// revision in force, read only, with the Authors filter; Edit and Delete act in the person's own draft, and a note
// waiting there is marked. In the past the page is read only and has no tools.
"use client";

import { DataTable, Dialog, MaxitorCanvas, PanelPage, usePanelPath, usePanelQuery, usePanelRouter } from "@maxitor/panel";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { call } from "../../../notes/api";
import { marksInDraft, STATE_LABEL, type Change } from "../../../notes/draft";
import { DraftIcon } from "../../../notes/marking";
import { CARD_GAP, cardsBounds, refusalText } from "../../../notes/notes";
import { useFresh } from "../../../notes/parts";
import { HEAD, RevisionCard, type PublishedNote, type Revision } from "../../../notes/revision";
import { initials, paletteOf } from "../people";

/** The page's own ready stretch of the date range picker: since the first publication, when there is one. */
function SINCE_FIRST(revision: Revision | null) {
  return revision?.first_at ? [{ label: "Since the first publication", from: revision.first_at.slice(0, 10), to: "now" }] : [];
}

export function PublishedView({
  org,
  itemId,
  revision,
  notes,
  changes,
}: {
  org: string;
  itemId: string;
  revision: Revision | null;
  notes: PublishedNote[];
  changes: Change[];
}) {
  const query = usePanelQuery();
  const { view = "cards", at, author } = query;
  const now = !at;
  const router = useRouter();
  const panelRouter = usePanelRouter();
  const path = usePanelPath();
  const draftPath = path.replace(/\/published$/, "");
  useFresh(notes.map((note) => note.id), now);
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<PublishedNote | null>(null);

  const marks = marksInDraft(changes);
  const authors = [...new Map(notes.map((note) => [note.writer_id, note.writer_name])).entries()];
  const chosen = author ? new Set(author.split(",").filter(Boolean)) : null;
  const shown = chosen ? notes.filter((note) => chosen.has(note.writer_id)) : notes;
  const below = cardsBounds(Math.max(shown.length, 1));
  const bounds = { x: 0, y: 0, width: below.width, height: HEAD + CARD_GAP + below.height };

  const edit = (note: PublishedNote) => panelRouter.push({ path: draftPath, query: { edit: note.id } });
  const openDraft = () => panelRouter.push({ path: draftPath, query: {} });
  const remove = async (note: PublishedNote) => {
    setBusy(true);
    const search = new URLSearchParams({ item_id: itemId, base_revision: String(revision?.number ?? "") });
    const answer = await call(org, "DELETE", `/notes/${encodeURIComponent(note.id)}?${search.toString()}`);
    setBusy(false);
    if (!answer.ok) setSaid(refusalText(answer.refusal, answer.status));
    else router.refresh();
  };

  return (
    <PanelPage
      title="Published"
      history={{ milestones: "list_note_history", card: "note_milestone_card" }}
      filters={[
        ...(authors.length ? [{ title: "Authors", param: "author", rows: authors.map(([key, name]) => ({ key, label: name, mark: initials(name), colour: paletteOf(key) })) }] : []),
        // Two ranges of dates, named by the table's columns: when a note was first written and when it last changed.
        { kind: "range", title: "Written", param: "written", unit: "date", presets: SINCE_FIRST(revision) },
        { kind: "range", title: "Last change", param: "changed", unit: "date", presets: SINCE_FIRST(revision) },
      ]}
    >
      <MaxitorCanvas bounds={bounds} label="Published">
        <RevisionCard revision={revision} notes={notes} waiting={changes.length} onOpenDraft={openDraft} empty="Nothing is published yet: publish the draft to make the first revision." />
        {said ? <div className="nt-said nt-over" style={{ top: HEAD - 58 }}>{said}</div> : null}
        {view === "table" ? (
          <DataTable
            name={revision ? revision.ref : "Notes"}
            at={{ x: 0, y: HEAD + CARD_GAP }}
            rows={shown}
            rowKey={(note) => note.id}
            anchor={(note) => `note:${note.id}`}
            columns={[
              { title: "Writer", kind: "person", value: (note) => note.writer_name, colour: (note) => paletteOf(note.writer_id), width: 1 },
              { title: "Note", value: (note) => note.body, width: 3 },
              { title: "Written", kind: "date", value: (note) => note.written ?? "", width: 1 },
              { title: "Last change", kind: "date", value: (note) => note.updated_at, width: 1 },
            ]}
          />
        ) : (
          <div className="mx-cards nt-grid" style={{ top: HEAD + CARD_GAP, width: below.width }}>
            {revision && shown.length === 0 ? (
              <div className="mx-empty-state" style={{ margin: 0, maxWidth: "none" }}>
                <b>Nothing to show</b>The filters hide every published note.
              </div>
            ) : (
              shown.map((note) => {
                const mark = marks.get(note.id);
                return (
                  <article key={note.id} className="mx-card nt-card" data-room-anchor={`note:${note.id}`}>
                    <div className="mx-card-head">
                      <b>{note.writer_name}</b>
                      <span>{note.changed_by && note.changed_by !== note.writer_name ? `changed by ${note.changed_by}` : ""}</span>
                      {now ? (
                        <span className="nt-tools">
                          <button type="button" title="Change it in my draft" onClick={() => edit(note)}>Edit</button>
                          <button type="button" title="Delete it in my draft" disabled={busy} onClick={() => remove(note)}>Delete</button>
                          <button type="button" className="nt-more" aria-label="Note actions" onClick={() => setMenu(note)}>⋯</button>
                        </span>
                      ) : null}
                    </div>
                    <div className="nt-body">{note.body}</div>
                    {mark ? (
                      <button type="button" className={`nt-mark ${mark}`} onClick={openDraft}>
                        <DraftIcon />
                        In your draft: {STATE_LABEL[mark].toLowerCase()}
                      </button>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        )}
      </MaxitorCanvas>
      {menu ? (
        <Dialog title="Note" onClose={() => setMenu(null)}>
          <button type="button" className="nt-sheet-button" onClick={() => { setMenu(null); edit(menu); }}>Edit in my draft</button>
          <button type="button" className="nt-sheet-button nt-danger" disabled={busy} onClick={() => { setMenu(null); void remove(menu); }}>Delete in my draft</button>
        </Dialog>
      ) : null}
    </PanelPage>
  );
}
