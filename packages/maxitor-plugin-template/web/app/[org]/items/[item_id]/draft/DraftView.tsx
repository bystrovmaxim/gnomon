// web/app/[org]/items/[item_id]/draft/DraftView.tsx — Draft on the canvas: a card per change since the last revision,
// with who and when; at now "Publish" opens a dialog with a title, a comment and an optional release.
"use client";

import { Dialog, MaxitorCanvas, PanelPage, usePanelQuery } from "@maxitor/panel";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { call } from "../../../notes/api";
import { CARD_GAP, cardsBounds, refusalText, when } from "../../../notes/notes";
import { useFresh } from "../../../notes/parts";
import { HEAD, RevisionCard, type Change, type Revision } from "../../../notes/revision";

export function DraftView({ org, itemId, revision, changes }: { org: string; itemId: string; revision: Revision | null; changes: Change[] }) {
  const { at } = usePanelQuery();
  const router = useRouter();
  useFresh(changes.map((change) => `${change.note_id}:${change.at}`), !at);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState({ title: "", comment: "", release: "" });
  const [said, setSaid] = useState("");
  const below = cardsBounds(changes.length);
  const bounds = { x: 0, y: 0, width: below.width, height: HEAD + CARD_GAP + below.height };

  const publish = async () => {
    const answer = await call<{ number: number }>(org, "POST", "/revisions", {
      item_id: itemId,
      title: form.title,
      comment: form.comment,
      release: form.release.trim() || null,
    });
    if (!answer.ok) return setSaid(refusalText(answer.refusal, answer.status));
    setPublishing(false);
    setForm({ title: "", comment: "", release: "" });
    setSaid("");
    router.refresh();
  };

  return (
    // The draft is a comparison already: it offers one moment only.
    <PanelPage title="Draft" history={{ compare: [] }} actions={[{ title: "Publish", icon: "plus", onClick: () => setPublishing(true) }]}>
      <MaxitorCanvas bounds={bounds} label="Draft">
        <RevisionCard revision={revision} empty="No revision yet: everything below is new." />
        <div className="mx-cards nt-grid" style={{ top: HEAD + CARD_GAP, width: below.width }}>
          {changes.length === 0 ? (
            <article className="mx-card nt-card"><b>Nothing changed since the last revision.</b></article>
          ) : (
            changes.map((change) => (
              <article key={`${change.note_id}-${change.at}`} className="mx-card nt-card" data-room-anchor={`note:${change.note_id}`}>
                <div className="mx-card-head">
                  <span className={`nt-kind ${change.kind}`}>{change.kind}</span>
                  <b>{change.by_name}</b>
                  <span>{when(change.at)}</span>
                </div>
                {change.before && change.kind === "changed" ? <div className="nt-before">{change.before}</div> : null}
                <div className={change.kind === "removed" ? "nt-before" : "nt-body"}>{change.body}</div>
              </article>
            ))
          )}
        </div>
      </MaxitorCanvas>
      {publishing ? (
        <Dialog title="Publish a revision" onClose={() => setPublishing(false)}>
          <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.currentTarget.value })} autoFocus /></label>
          <label>Comment<textarea rows={3} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.currentTarget.value })} /></label>
          <label>Release, if any<input value={form.release} onChange={(event) => setForm({ ...form, release: event.currentTarget.value })} placeholder="2026.11" /></label>
          {said ? <div className="nt-said" role="status">{said}</div> : null}
          <div className="nt-row">
            <button type="button" onClick={() => setPublishing(false)}>Cancel</button>
            <button type="button" className="nt-primary" disabled={!form.title.trim() || !form.comment.trim()} onClick={publish}>Publish</button>
          </div>
        </Dialog>
      ) : null}
    </PanelPage>
  );
}
