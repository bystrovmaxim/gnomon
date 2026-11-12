// web/app/[org]/items/[item_id]/published/PublishedView.tsx — Published on the canvas: everyone's notes of the
// revision in force, read only, with the Authors filter; Edit and Delete act in the person's own draft, and a note
// waiting there is marked. In the past the page is read only and has no tools. In a comparison (spec 079, 1.5) each
// note wears what happened to it between A and B — its halo, the rest faded while the changes paint —, the filter adds
// Changes, the stepper walks the changes with each one's card, and the counts go to the pill.
"use client";

import { ChangeStepper, countsOf, DataTable, Dialog, DiffCard, MaxitorCanvas, PanelPage, useBackToNow, useCanvas, useCounts, useMoment, usePanelPath, usePanelQuery, usePanelRouter } from "@maxitor/panel";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { call } from "../../../notes/api";
import { compareNotes } from "../../../notes/compare";
import { PUBLISHED_HISTORY } from "../../../notes/history";
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
  other,
  latest,
}: {
  org: string;
  itemId: string;
  revision: Revision | null;
  notes: PublishedNote[];
  changes: Change[];
  /** The notes at the other moment of a comparison; null at one moment. */
  other: PublishedNote[] | null;
  /** The number of the revision in force now: only an older one can be rolled back to. */
  latest: number | null;
}) {
  const query = usePanelQuery();
  const { view = "cards", at, author, change, paint } = query;
  const { side } = useMoment();
  const now = !at && other === null;
  const router = useRouter();
  const panelRouter = usePanelRouter();
  const path = usePanelPath();
  const draftPath = path.replace(/\/published$/, "");
  useFresh(notes.map((note) => note.id), now);
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<PublishedNote | null>(null);
  const backToNow = useBackToNow();
  // Roll back, offered by the core exactly on a past publication: the dialog, and what it changes against now.
  const [rolling, setRolling] = useState<{ to: number; title: string; comment: string; current: PublishedNote[] | null } | null>(null);
  const openRollback = async (milestone: string) => {
    const to = Number(milestone.replace(/^v/, ""));
    setRolling({ to, title: `Back to v${to}`, comment: "", current: null });
    const answer = await call(org, "GET", `/items/${encodeURIComponent(itemId)}/published`);
    const current = answer.ok ? ((answer.data as { notes: PublishedNote[] }).notes ?? []) : [];
    setRolling((was) => (was && was.to === to ? { ...was, current } : was));
  };
  const rollBack = async () => {
    if (!rolling) return;
    setBusy(true);
    const answer = await call(org, "POST", "/revisions/rollback", { item_id: itemId, to_revision: rolling.to, title: rolling.title, comment: rolling.comment });
    setBusy(false);
    if (!answer.ok) {
      setSaid(refusalText(answer.refusal, answer.status));
      return;
    }
    setRolling(null);
    backToNow();
  };

  const marks = marksInDraft(changes);
  const authors = [...new Map(notes.map((note) => [note.writer_id, note.writer_name])).entries()];
  const chosen = author ? new Set(author.split(",").filter(Boolean)) : null;
  // A comparison: what happened to each note, the notes B lost drawn as ghosts in Diff, and the steps through them.
  const compared = compareNotes(notes, other, side);
  const changesChosen = change ? new Set(change.split(",").filter(Boolean)) : null;
  const all = [...notes, ...compared.ghosts];
  const shown = all.filter((note) => (!chosen || chosen.has(note.writer_id)) && (!changesChosen || changesChosen.has(compared.status.get(note.id) ?? "")));
  const statusOf = (note: PublishedNote) => compared.status.get(note.id);
  const paintChanges = other !== null && (paint ?? "change") === "change";
  const [position, setPosition] = useState<number | null>(null);
  useEffect(() => setPosition(null), [at, other === null]);
  const step = position === null ? null : compared.steps[position] ?? null;
  const stepNote = step ? all.find((note) => `note:${note.id}` === step.key) ?? null : null;
  const wasBody = stepNote ? other?.find((note) => note.id === stepNote.id)?.body : undefined;
  useCounts(other !== null && side !== "a" ? countsOf(compared.steps) : null);
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
      history={PUBLISHED_HISTORY}
      stepper={other !== null ? <ChangeStepper entries={compared.steps} position={position} onGo={setPosition} /> : undefined}
      onMilestoneAction={
        revision && latest !== null && revision.number < latest
          ? (action, milestone) => action.action === "rollback_publication" && void openRollback(milestone)
          : undefined
      }
      filters={[
        // A comparison's changes come first and paint by default; the halo marks a note, the rest fades.
        ...(other !== null
          ? [
              {
                title: "Changes",
                param: "change",
                paints: true,
                rows: (["added", "changed", "removed", "unchanged"] as const).map((key) => ({
                  key,
                  label: key[0].toUpperCase() + key.slice(1),
                  colour: ({ added: "green", changed: "amber", removed: "red", unchanged: "grey" } as const)[key],
                  absent: ![...compared.status.values()].includes(key),
                })),
              },
            ]
          : []),
        ...(authors.length ? [{ title: "Authors", param: "author", paints: other !== null, rows: authors.map(([key, name]) => ({ key, label: name, mark: initials(name), colour: paletteOf(key) })) }] : []),
        // Two ranges of dates, named by the table's columns: when a note was first written and when it last changed.
        { kind: "range", title: "Written", param: "written", unit: "date", presets: SINCE_FIRST(revision) },
        { kind: "range", title: "Last change", param: "changed", unit: "date", presets: SINCE_FIRST(revision) },
      ]}
    >
      {stepNote && step ? (
        <DiffCard
          target={{
            title: stepNote.writer_name,
            status: step.status,
            differences: step.status === "changed" ? [{ path: ["text"], change: "changed", before: wasBody, after: stepNote.body }] : undefined,
            note: step.status !== "changed" ? stepNote.body : undefined,
          }}
          at={{ x: 16, y: 56 }}
          onClose={() => setPosition(null)}
        />
      ) : null}
      <MaxitorCanvas bounds={bounds} label="Published">
        <Bring anchor={step?.key ?? null} />
        <RevisionCard revision={revision} notes={notes} waiting={changes.length} onOpenDraft={openDraft} empty="Nothing is published yet: publish the draft to make the first revision." />
        {said ? <div className="nt-said nt-over" style={{ top: HEAD - 58 }}>{said}</div> : null}
        {view === "table" ? (
          <DataTable
            name={revision ? revision.ref : "Notes"}
            at={{ x: 0, y: HEAD + CARD_GAP }}
            rows={shown}
            rowKey={(note) => note.id}
            anchor={(note) => `note:${note.id}`}
            change={statusOf}
            columns={[
              { title: "Writer", kind: "person", value: (note) => note.writer_name, colour: (note) => paletteOf(note.writer_id), width: 1 },
              { title: "Note", value: (note) => note.body, width: 3 },
              { title: "Written", kind: "date", value: (note) => note.written ?? "", width: 1 },
              { title: "Last change", kind: "date", value: (note) => note.updated_at, width: 1 },
            ]}
          />
        ) : (
          <div className="mx-cards nt-grid" style={{ top: HEAD + CARD_GAP, width: below.width }} data-paint={paintChanges ? "changes" : undefined}>
            {revision && shown.length === 0 ? (
              <div className="mx-empty-state" style={{ margin: 0, maxWidth: "none" }}>
                <b>Nothing to show</b>The filters hide every published note.
              </div>
            ) : (
              shown.map((note) => {
                const mark = marks.get(note.id);
                return (
                  <article key={note.id} className="mx-card nt-card" data-room-anchor={`note:${note.id}`} data-change={statusOf(note)}>
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
      {rolling ? (
        <Dialog title={`Roll back to v${rolling.to}?`} onClose={() => setRolling(null)}>
          <div className="nt-foot">
            Published becomes the next revision, holding the notes of v{rolling.to}. Nothing is lost: everything published after v{rolling.to} stays in the history and
            on the scale, and the new revision stands on it as a red point.
          </div>
          <label>Title<input value={rolling.title} onChange={(event) => setRolling({ ...rolling, title: event.currentTarget.value })} autoFocus /></label>
          <label>Comment<textarea rows={3} value={rolling.comment} onChange={(event) => setRolling({ ...rolling, comment: event.currentTarget.value })} placeholder="Why the notes go back" /></label>
          <div className="nt-sec">What the rollback changes against now</div>
          <div className="nt-foot">{rolling.current === null ? "Reading…" : rollbackSummary(compareNotes(notes, rolling.current, null).steps)}</div>
          {said ? <div className="nt-said" role="status">{said}</div> : null}
          <div className="nt-row">
            <button type="button" onClick={() => setRolling(null)}>Cancel</button>
            <button type="button" className="nt-primary nt-danger" disabled={busy || !rolling.title.trim() || !rolling.comment.trim()} onClick={() => void rollBack()}>
              Roll back to v{rolling.to}
            </button>
          </div>
        </Dialog>
      ) : null}
      {menu ? (
        <Dialog title="Note" onClose={() => setMenu(null)}>
          <button type="button" className="nt-sheet-button" onClick={() => { setMenu(null); edit(menu); }}>Edit in my draft</button>
          <button type="button" className="nt-sheet-button nt-danger" disabled={busy} onClick={() => { setMenu(null); void remove(menu); }}>Delete in my draft</button>
        </Dialog>
      ) : null}
    </PanelPage>
  );
}

/** The stepper's step brought into the middle of the canvas, keeping the zoom. */
function Bring({ anchor }: { anchor: string | null }) {
  // Only a new step moves the camera: the canvas changes with every move, so it is read, not watched.
  const api = useCanvas();
  const canvas = useRef(api);
  canvas.current = api;
  useEffect(() => {
    if (anchor) canvas.current.bring(anchor);
  }, [anchor]);
  return null;
}

/** What a rollback changes, as the dialog says it: "+2 notes · 1 changed · −1 note", or "no changes". */
function rollbackSummary(steps: readonly { status: "added" | "changed" | "removed" }[]): string {
  const count = (status: string) => steps.filter((step) => step.status === status).length;
  const notes = (n: number) => `${n} ${n === 1 ? "note" : "notes"}`;
  const parts = [count("added") ? `+${notes(count("added"))}` : "", count("changed") ? `${count("changed")} changed` : "", count("removed") ? `−${notes(count("removed"))}` : ""].filter(Boolean);
  return parts.join(" · ") || "no changes";
}
