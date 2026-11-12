// web/app/[org]/items/[item_id]/DraftView.tsx — Draft on the canvas: the person's own changes over the published
// notes, each with its state, its base and the words that changed; at now New note, Edit, Revert and Publish; a
// change that meets someone else's publication is marked and resolved in the publishing dialog.
"use client";

import { Dialog, MaxitorCanvas, PanelPage, usePanelQuery, usePanelRouter } from "@maxitor/panel";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { call } from "../../notes/api";
import {
  baseLine,
  choiceLabel,
  conflictLine,
  counts,
  draftOrder,
  raceLine,
  stateRows,
  visibleChanges,
  waitingLine,
  STATE_LABEL,
  type Change,
} from "../../notes/draft";
import { Marking } from "../../notes/marking";
import { CARD_GAP, cardsBounds, refusalText, when } from "../../notes/notes";
import { useFresh } from "../../notes/parts";
import { HEAD, RevisionCard, type PublishedNote, type Revision } from "../../notes/revision";

type Editing = { noteId: string; body: string; baseBody: string | null; baseRevision: number | null; stored: boolean };

/** The draft's head: whose draft it is, what revision it was made over, and how many changes of each state wait. */
function DraftHead({ revision, changes }: { revision: Revision | null; changes: Change[] }) {
  const found = counts(changes);
  const countsLine = (["new", "changed", "deleted"] as const)
    .filter((state) => found[state])
    .map((state) => `${found[state]} ${STATE_LABEL[state].toLowerCase()}`)
    .join(" · ");
  const base = changes.map((change) => change.base_revision).filter((number): number is number => number !== null);
  return (
    <article className="mx-card nt-revision" data-room-anchor={`revision:${revision?.number ?? 0}`}>
      <div className="mx-card-head">
        <span className="nt-ref dr">Draft</span>
        <b>Your draft</b>
        <span>seen by you alone · made over v{base.length ? Math.min(...base) : revision?.number ?? "—"} · published whole, as one revision</span>
        {countsLine ? <span className="nt-counts">{countsLine}</span> : null}
      </div>
    </article>
  );
}

export function DraftView({
  org,
  itemId,
  revision,
  changes,
  published,
  publishedRevision,
}: {
  org: string;
  itemId: string;
  revision: Revision | null;
  changes: Change[];
  published: PublishedNote[];
  publishedRevision: Revision | null;
}) {
  const query = usePanelQuery();
  const { at } = query;
  const now = !at;
  const stateParam = typeof query.state === "string" ? query.state : undefined;
  const editId = typeof query.edit === "string" ? query.edit : null;
  const router = useRouter();
  const panelRouter = usePanelRouter();
  useFresh(changes.map((change) => `${change.note_id}:${change.changed_at}`), now);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [reverting, setReverting] = useState<Change | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState({ title: "", comment: "", release: "" });
  const [conflicts, setConflicts] = useState<Change[] | null>(null);
  const [choices, setChoices] = useState<Record<string, "overwrite" | "give_up">>({});

  const ordered = draftOrder(changes);
  const visible = visibleChanges(ordered, stateParam);
  const race = raceLine(changes);
  const below = cardsBounds(Math.max(visible.length, 1));
  const gridTop = HEAD + (race ? 72 : 0) + CARD_GAP;
  const bounds = { x: 0, y: 0, width: below.width, height: gridTop + below.height };

  const closeEditing = () => {
    setEditing(null);
    setSaid("");
    const next = { ...query };
    delete next.edit;
    panelRouter.replace({ query: next });
  };

  // A card opened from Published arrives in the address as ?edit=<note_id>: the change waits in the draft, or the
  // editor starts from the published note and nothing is written until it is saved.
  useEffect(() => {
    if (!editId) return;
    const found = changes.find((change) => change.note_id === editId);
    if (found) {
      setEditing({ noteId: found.note_id, body: found.body, baseBody: found.base_body, baseRevision: found.base_revision, stored: true });
      return;
    }
    const note = published.find((one) => one.id === editId);
    if (note) setEditing({ noteId: note.id, body: note.body, baseBody: note.body, baseRevision: publishedRevision?.number ?? null, stored: false });
  }, [editId]);

  const close = () => {
    setPublishing(false);
    setConflicts(null);
    setChoices({});
    setSaid("");
    setForm({ title: "", comment: "", release: "" });
  };

  const write = async () => {
    setBusy(true);
    const answer = await call(org, "POST", "/notes", { item_id: itemId, body: text });
    setBusy(false);
    if (!answer.ok) return setSaid(refusalText(answer.refusal, answer.status));
    setWriting(false);
    setText("");
    setSaid("");
    router.refresh();
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    const answer = await call(org, "PATCH", "/notes", {
      item_id: itemId,
      note_id: editing.noteId,
      body: editing.body,
      base_body: editing.baseBody,
      base_revision: editing.baseRevision,
    });
    setBusy(false);
    if (!answer.ok) return setSaid(refusalText(answer.refusal, answer.status));
    closeEditing();
    router.refresh();
  };

  const revert = async () => {
    if (!reverting) return;
    setBusy(true);
    const answer = await call(org, "DELETE", `/draft/${encodeURIComponent(reverting.note_id)}`);
    setBusy(false);
    setReverting(null);
    if (!answer.ok) return setSaid(refusalText(answer.refusal, answer.status));
    router.refresh();
  };

  const publish = async (resolved: boolean) => {
    setBusy(true);
    const answer = await call<{ number: number }>(org, "POST", "/revisions", {
      item_id: itemId,
      title: form.title,
      comment: form.comment,
      release: form.release.trim() || null,
      resolutions: resolved ? Object.entries(choices).map(([note_id, choice]) => ({ note_id, choice })) : null,
    });
    setBusy(false);
    if (answer.ok) {
      close();
      router.refresh();
      return;
    }
    if (answer.refusal?.error === "conflicts") {
      setConflicts((answer.refusal.conflicts as Change[]) ?? []);
      setChoices({});
      return;
    }
    setSaid(refusalText(answer.refusal, answer.status));
  };

  const decided = conflicts?.every((conflict) => choices[conflict.note_id]) ?? false;

  return (
    <PanelPage
      title="Draft"
      // The draft is a comparison already: it offers one moment only.
      history={{ compare: [] }}
      filters={[{ title: "State", param: "state", rows: stateRows(changes) }]}
      actions={[
        { title: "New note", icon: "plus", onClick: () => { setWriting(true); setSaid(""); } },
        { title: "Publish", icon: "check", onClick: () => { setPublishing(true); setSaid(""); } },
      ]}
    >
      <MaxitorCanvas bounds={bounds} label="Draft">
        <DraftHead revision={revision} changes={changes} />
        {race ? <div className="nt-race" style={{ top: HEAD }}>{race}</div> : null}
        <div className="mx-cards nt-grid" style={{ top: gridTop, width: below.width }}>
          {visible.length === 0 ? (
            <div className="mx-empty-state" style={{ margin: 0, maxWidth: "none" }}>
              <b>{changes.length ? "Nothing to show" : "Your draft is empty"}</b>
              {changes.length
                ? "The State filter hides every change of your draft."
                : "Write a new note, or change or delete a published one on Published: the change waits here, seen by you alone, until you publish."}
            </div>
          ) : (
            visible.map((change) => (
              <article
                key={`${change.note_id}:${change.changed_at}`}
                className={`mx-card nt-card nt-state-${change.state}${change.conflict ? " meets" : ""}`}
                data-room-anchor={`note:${change.note_id}`}
              >
                <div className="mx-card-head">
                  <b>{change.writer_name}</b>
                  <span>{when(change.changed_at)}</span>
                  {now && editing?.noteId !== change.note_id ? (
                    <span className="nt-tools">
                      {change.state !== "deleted" ? (
                        <button type="button" onClick={() => setEditing({ noteId: change.note_id, body: change.body, baseBody: change.base_body, baseRevision: change.base_revision, stored: true })}>
                          Edit
                        </button>
                      ) : null}
                      <button type="button" onClick={() => setReverting(change)}>Revert</button>
                      <button type="button" className="nt-more" aria-label="Change actions" onClick={() => setReverting(change)}>⋯</button>
                    </span>
                  ) : null}
                </div>
                <span className={`nt-kind ${change.state}`}>{STATE_LABEL[change.state]}</span>
                {editing?.noteId === change.note_id ? (
                  <div className="nt-edit">
                    <textarea value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.currentTarget.value })} aria-label="The note's text" rows={4} autoFocus />
                    <div className="nt-row">
                      <button type="button" onClick={closeEditing}>Cancel</button>
                      <button type="button" className="nt-primary" disabled={busy || !editing.body.trim()} onClick={save}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="nt-body">
                    {change.state === "deleted" ? (
                      <span className="nt-gone">{change.base_body}</span>
                    ) : change.state === "changed" ? (
                      <Marking before={change.base_body ?? ""} after={change.body} />
                    ) : (
                      change.body
                    )}
                  </div>
                )}
                <div className="nt-foot">{baseLine(change)}</div>
                {change.conflict ? (
                  <div className="nt-meet">
                    {change.published_by_name} {change.published_body === null ? "deleted it" : "changed it"} on {when(change.published_at)}: you choose when you publish.
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </MaxitorCanvas>

      {writing ? (
        <Dialog title="New note" onClose={() => setWriting(false)}>
          <textarea value={text} onChange={(event) => setText(event.currentTarget.value)} aria-label="The note's text" rows={5} autoFocus />
          <div className="nt-foot">It goes into your draft, seen by you alone, until you publish.</div>
          {said ? <div className="nt-said" role="status">{said}</div> : null}
          <div className="nt-row">
            <button type="button" onClick={() => setWriting(false)}>Cancel</button>
            <button type="button" className="nt-primary" disabled={busy || !text.trim()} onClick={write}>Write</button>
          </div>
        </Dialog>
      ) : null}

      {reverting ? (
        <Dialog
          title={reverting.state === "new" ? "Remove this new note?" : reverting.state === "changed" ? "Give up your change?" : "Give up the deletion?"}
          onClose={() => setReverting(null)}
        >
          <div className="nt-body">
            {reverting.state === "deleted" ? (
              <span className="nt-gone">{reverting.base_body}</span>
            ) : reverting.state === "changed" ? (
              <Marking before={reverting.base_body ?? ""} after={reverting.body} />
            ) : (
              reverting.body
            )}
          </div>
          <div className="nt-foot">
            {reverting.state === "new"
              ? "It was never published: it disappears and leaves nothing on Published."
              : `The note stays as v${reverting.base_revision ?? "—"} has it, and leaves your draft.`}
          </div>
          <div className="nt-row">
            <button type="button" onClick={() => setReverting(null)}>Keep</button>
            <button type="button" className="nt-primary" disabled={busy} onClick={revert}>{reverting.state === "new" ? "Remove" : "Give up"}</button>
          </div>
        </Dialog>
      ) : null}

      {publishing ? (
        <Dialog title={`Publish your draft as v${(revision?.number ?? 0) + 1}`} onClose={close}>
          <div className="nt-foot">
            Every change of your draft goes in as one revision: from now on everyone in the organization reads it on
            Published, and it becomes a milestone of the time scale. Your draft starts empty again.
          </div>
          <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.currentTarget.value })} autoFocus /></label>
          <label>Comment<textarea rows={3} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.currentTarget.value })} /></label>
          <label>Release, if any<input value={form.release} onChange={(event) => setForm({ ...form, release: event.currentTarget.value })} placeholder="2026.11" /></label>
          {conflicts ? (
            <>
              <div className="nt-said">
                Someone published over your draft. Choose for each conflict: a change you give up disappears from the
                draft, an overwrite replaces what is published now.
              </div>
              <div className="nt-sec">{conflicts.length} meet someone else&apos;s publication</div>
              {conflicts.map((conflict) => (
                <div key={conflict.note_id} className={`nt-conflict ${choices[conflict.note_id] ?? ""}`}>
                  <div className="mx-card-head">
                    <b>{conflict.writer_name === "" ? "A note" : `${conflict.writer_name}'s note`}</b>
                    <span>{conflictLine(conflict)}</span>
                  </div>
                  <div className="nt-side">
                    <i>Yours · {STATE_LABEL[conflict.state].toLowerCase()} {when(conflict.changed_at)}</i>
                    {conflict.state === "deleted" ? <span className="nt-gone">{conflict.base_body}</span> : <Marking before={conflict.base_body ?? ""} after={conflict.body} />}
                  </div>
                  <div className="nt-side">
                    <i>
                      {conflict.published_by_name} · {conflict.published_body === null ? "deleted" : "changed"} {when(conflict.published_at)}
                    </i>
                    {conflict.published_body === null ? (
                      <span className="nt-gone">{conflict.base_body}</span>
                    ) : (
                      <Marking before={conflict.base_body ?? ""} after={conflict.published_body} />
                    )}
                  </div>
                  <div className="nt-choice">
                    <button type="button" className={choices[conflict.note_id] === "overwrite" ? "on" : ""} onClick={() => setChoices({ ...choices, [conflict.note_id]: "overwrite" })}>
                      {choiceLabel(conflict, "overwrite")}
                    </button>
                    <button type="button" className={choices[conflict.note_id] === "give_up" ? "on" : ""} onClick={() => setChoices({ ...choices, [conflict.note_id]: "give_up" })}>
                      {choiceLabel(conflict, "give_up")}
                    </button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="nt-sec">{waitingLine(changes)} go in as they are</div>
          )}
          {said ? <div className="nt-said" role="status">{said}</div> : null}
          <div className="nt-row">
            <button type="button" onClick={close}>Cancel</button>
            <button
              type="button"
              className="nt-primary"
              disabled={busy || !form.title.trim() || !form.comment.trim() || (conflicts !== null && !decided)}
              onClick={() => publish(conflicts !== null)}
            >
              Publish v{(revision?.number ?? 0) + 1}
            </button>
          </div>
        </Dialog>
      ) : null}
    </PanelPage>
  );
}
