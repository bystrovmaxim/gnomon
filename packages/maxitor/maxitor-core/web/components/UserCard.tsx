// packages/maxitor/maxitor-core/web/components/UserCard.tsx
// A user's card (mockup 9.2–9.6): the lifecycle's states and the buttons that move it, the administrator mark as a
// switch, the last active administrator's hint and how the user appeared. A user is never removed: Block stops them.
"use client";
import { Button } from "@maxitor/panel";
import { AdminDialog } from "./administration/AdminDialog";

import { useEffect, useState } from "react";
import { Alert } from "@/components/fields";
import { day, when } from "@/components/InviteDialog";
import type { User } from "@/app/users";
import type { Refusal } from "@/lib/core";

export const USER_STATES: Record<string, string> = { active: "Active", blocked: "Blocked", removed: "Left" };

export function UserCard({ user, me, last, refusal, busy, organization, onClose, onBlock, onUnblock, onMark, readOnly = false, changeKind, onJobTitle }: {
  user: User;
  readOnly?: boolean;
  onJobTitle?: (title: string) => Promise<void>;
  changeKind?: string;
  /** The signed-in administrator's own user id. */
  me: string;
  /** Whether this user is the last active administrator: the card says so and its buttons go dim. */
  last: boolean;
  refusal: Refusal | null;
  busy: boolean;
  organization: string;
  onClose: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onMark: (isAdmin: boolean) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(user.job_title ?? "");
  useEffect(() => { setTitle(user.job_title ?? ""); setEditingTitle(false); }, [user.job_title]);
  const dim = last ? { disabled: true, title: "The last active administrator" } : { disabled: busy };
  return (
    <AdminDialog title={`User ${user.name}`} onClose={onClose}><div className="drawer admin-user-card" data-change={changeKind}>
      <div className="dh">
        <div className="dk"><span>User · {organization}</span><Button type="button" variant="icon" className="close" aria-label="Close" onClick={onClose}>✕</Button></div>
        <h3>{user.name}{user.id === me ? <span className="mut" style={{ fontWeight: 400 }}> · you</span> : null}</h3>
        <div className="dt">{user.email}</div>
        <div className="admin-user-status"><span className={`stt st-${user.state}`}>{USER_STATES[user.state]}</span>
        {!readOnly && user.state === "active" ? (
          <div className="acts">
            <Button type="button" variant="primary" {...dim} onClick={onBlock}>Block</Button>
          </div>
        ) : null}
        {!readOnly && user.state === "blocked" ? (
          <div className="acts">
            <Button type="button" variant="primary" disabled={busy} onClick={onUnblock}>Unblock</Button>
          </div>
        ) : null}
        </div>
        {refusal?.error === "last_administrator" ? (
          <div className="hintb bad2"><b>The last active administrator.</b> Someone else stepped down a moment ago, or there was never another: the mark stays. Appoint another administrator first.</div>
        ) : last && !readOnly ? (
          <div className="hintb warn2">The last active administrator: cannot be blocked or lose the mark. Appoint another one first.</div>
        ) : null}
        {refusal && refusal.error !== "last_administrator" ? <Alert kind="bad">The change was not made ({refusal.error}).</Alert> : null}
      </div>
      <div className="db">
        <dl className="kv">
          <dt>Job title</dt>
          <dd>{editingTitle && !readOnly ? <form className="admin-title-form" onSubmit={(event) => { event.preventDefault(); void onJobTitle?.(title); }}>
            <input aria-label="Job title" value={title} maxLength={160} onChange={event => setTitle(event.target.value)} autoFocus />
            <div className="acts"><Button variant="secondary" onClick={() => { setEditingTitle(false); setTitle(user.job_title ?? ""); }}>Cancel</Button><Button type="submit" variant="primary" disabled={busy || title === (user.job_title ?? "")}>Save</Button></div>
          </form> : <div className="admin-title-value"><span>{user.job_title || "Not specified"}</span>{!readOnly && onJobTitle ? <Button variant="primary" onClick={() => setEditingTitle(true)}>Edit</Button> : null}</div>}</dd>
          <dt>Administrator</dt>
          <dd>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" className="switch" checked={user.is_admin} disabled={readOnly || busy || last || user.state !== "active"} onChange={(e) => onMark(e.target.checked)} aria-label="Administrator" />
              <span>{user.is_admin ? "Administrator" : "Ordinary user"}</span>
            </label>
          </dd>
          <dt>Appeared</dt>
          <dd>{!user.created_at ? "Not recorded" : user.appeared === "registered" ? `registered the organization · ${day(user.created_at)}` : `by the invitation of ${user.invited_by?.name ?? "someone"} · ${day(user.created_at)}`}</dd>
          <dt>Last sign-in</dt>
          <dd>{readOnly ? "Not recorded in history" : user.last_sign_in_at ? when(user.last_sign_in_at) : "never"}</dd>
          {user.state === "blocked" ? <><dt>Last change</dt><dd>{when(user.changed_at)}{user.changed_by ? ` · by ${user.changed_by.name}` : ""} · cannot enter the organization until unblocked</dd></> : null}
        </dl>
        {user.state === "blocked" ? <div className="hintb">A blocked person is unblocked, not invited: an invitation to {user.email} is refused.</div> : null}
      </div>
    </div></AdminDialog>
  );
}
