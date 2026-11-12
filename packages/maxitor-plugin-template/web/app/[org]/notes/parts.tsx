// web/app/[org]/notes/parts.tsx — what the template's pages are made of: a note's card with its editing, its conflicts
// and its deleting, and the reading again when "now" moved. Dialogs are the shell's (Dialog of @maxitor/panel).
"use client";

import { Dialog, useWatermark } from "@maxitor/panel";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { call } from "./api";
import { refusalText, when, newSince } from "./notes";

/** A note as the page reads it. */
export type Note = { id: string; item_id: string; writer_id: string; writer_name: string; body: string; updated_at: string; since: string; changed_by?: string };

/**
 * Read the page again when "now" moved, if the page reads now; answers the notes written since the last reading by
 * someone else, to mark them new. The first reading marks none.
 */
export function useFresh(ids: readonly string[], now: boolean): Set<string> {
  const router = useRouter();
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const key = ids.join(",");
  useEffect(() => {
    // Counted before the ids read now become the known ones: the state's updater runs later.
    const added = newSince(known.current, ids);
    known.current = new Set(ids);
    if (added.size) setFresh((was) => new Set([...was, ...added]));
  }, [key]);
  useWatermark(
    useCallback(() => {
      if (now) router.refresh();
    }, [now, router]),
  );
  return fresh;
}

/** A note's card: its writer and time, its text; at now its edit and delete, behind "⋯" on a phone. */
export function NoteCard({ org, note, fresh, now, onChanged }: { org: string; note: Note; fresh: boolean; now: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.body);
  const [said, setSaid] = useState("");
  const [asking, setAsking] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const answer = await call(org, "PATCH", "/notes", { note_id: note.id, body: text, base_moment: note.since });
    setBusy(false);
    if (answer.ok) {
      setEditing(false);
      setSaid("");
      onChanged();
      return;
    }
    // A conflict keeps the person's text in the card; the page reads again, so a second save replaces the new version.
    setSaid(refusalText(answer.refusal, answer.status));
    onChanged();
  };
  const remove = async () => {
    setBusy(true);
    const answer = await call(org, "DELETE", `/notes/${encodeURIComponent(note.id)}?base_moment=${encodeURIComponent(note.since)}`);
    setBusy(false);
    setAsking(false);
    if (answer.ok) onChanged();
    else setSaid(refusalText(answer.refusal, answer.status));
  };

  return (
    <article className={`mx-card nt-card${fresh ? " fresh" : ""}`} data-room-anchor={`note:${note.id}`} data-note={note.id}>
      <div className="mx-card-head">
        <b>{note.writer_name}</b>
        <span>{when(note.updated_at)}</span>
        {fresh ? <span className="nt-new">New</span> : null}
        {now && !editing ? (
          <span className="nt-tools">
            <button type="button" onClick={() => { setText(note.body); setEditing(true); setSaid(""); }}>Edit</button>
            <button type="button" onClick={() => setAsking(true)}>Delete</button>
            <button type="button" className="nt-more" aria-label="Note actions" onClick={() => setMenu(true)}>⋯</button>
          </span>
        ) : null}
      </div>
      {editing ? (
        <div className="nt-edit">
          <textarea value={text} onChange={(event) => setText(event.currentTarget.value)} aria-label="The note's text" rows={4} />
          <div className="nt-row">
            <button type="button" onClick={() => { setEditing(false); setSaid(""); }}>Cancel</button>
            <button type="button" className="nt-primary" disabled={busy || !text.trim()} onClick={save}>Save</button>
          </div>
        </div>
      ) : (
        <div className="nt-body">{note.body}</div>
      )}
      {asking ? (
        <div className="nt-ask" role="alert">
          Delete this note? It stays in the past.
          <button type="button" onClick={() => setAsking(false)}>Keep</button>
          <button type="button" className="nt-danger" disabled={busy} onClick={remove}>Delete</button>
        </div>
      ) : null}
      {said ? <div className="nt-said" role="status">{said}</div> : null}
      {menu ? (
        <Dialog title="Note" onClose={() => setMenu(false)}>
          <button type="button" className="nt-sheet-button" onClick={() => { setMenu(false); setText(note.body); setEditing(true); }}>Edit</button>
          <button type="button" className="nt-sheet-button nt-danger" onClick={() => { setMenu(false); setAsking(true); }}>Delete</button>
        </Dialog>
      ) : null}
    </article>
  );
}
