// packages/maxitor/maxitor-core/web/components/UserCard.tsx
// A user's card (mockup 9.2–9.7): the lifecycle's states and the buttons that move it, the administrator mark as a
// switch, the last active administrator's hint, how the user appeared, and an invitation sent to a removed person again.
"use client";

import { Alert } from "@/components/fields";
import { day, when } from "@/components/InviteDialog";
import type { User } from "@/app/users";
import type { Invitation, Refusal } from "@/lib/core";

export const USER_STATES: Record<string, string> = { active: "Active", blocked: "Blocked", removed: "Removed" };

export function UserCard({ user, me, invitedAgain, last, refusal, busy, organization, onClose, onBlock, onUnblock, onRemove, onMark, onOpenInvitation }: {
  user: User;
  /** The signed-in administrator's own user id. */
  me: string;
  /** A Sent invitation to this removed person's email, when there is one. */
  invitedAgain: Invitation | null;
  /** Whether this user is the last active administrator: the card says so and its buttons go dim. */
  last: boolean;
  refusal: Refusal | null;
  busy: boolean;
  organization: string;
  onClose: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onRemove: () => void;
  onMark: (isAdmin: boolean) => void;
  onOpenInvitation: (id: string) => void;
}) {
  const dim = last ? { disabled: true, title: "The last active administrator" } : { disabled: busy };
  return (
    <div className="drawer" role="dialog" aria-label={`User ${user.name}`}>
      <div className="dh">
        <div className="dk"><span>User · {organization}</span><button type="button" className="close" aria-label="Close" onClick={onClose}>✕</button></div>
        <h3>{user.name}{user.id === me ? <span className="mut" style={{ fontWeight: 400 }}> · you</span> : null}</h3>
        <div className="dt">{user.email}</div>
        <div className="life">{Object.entries(USER_STATES).map(([k, t]) => <span key={k} className={k === user.state ? "on" : ""}>{t}</span>)}</div>
        {user.state === "active" ? (
          <div className="acts">
            <button type="button" className="btn2" {...dim} onClick={onBlock}>Block</button>
            <button type="button" className="btn2 danger" {...dim} onClick={onRemove}>Remove</button>
          </div>
        ) : null}
        {user.state === "blocked" ? (
          <div className="acts">
            <button type="button" className="btn2 pri" disabled={busy} onClick={onUnblock}>Unblock</button>
            <button type="button" className="btn2 danger" disabled={busy} onClick={onRemove}>Remove</button>
          </div>
        ) : null}
        {user.state === "removed" ? <div className="fine2" style={{ marginTop: 10 }}>Removed {when(user.changed_at)}{user.changed_by ? ` · by ${user.changed_by.name}` : ""}. Final: there is no way back from “Removed”, but the person may be invited again.</div> : null}
        {refusal?.error === "last_administrator" ? (
          <div className="hintb bad2"><b>The last active administrator.</b> Someone else stepped down a moment ago, or there was never another: the mark stays. Appoint another administrator first.</div>
        ) : last ? (
          <div className="hintb warn2">The last active administrator: cannot be blocked, removed or lose the mark. Appoint another one first.</div>
        ) : null}
        {refusal && refusal.error !== "last_administrator" ? <Alert kind="bad">The change was not made ({refusal.error}).</Alert> : null}
      </div>
      <div className="db">
        <dl className="kv">
          <dt>Administrator</dt>
          <dd>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" className="switch" checked={user.is_admin} disabled={busy || last || user.state !== "active"} onChange={(e) => onMark(e.target.checked)} aria-label="Administrator" />
              <span>{user.is_admin ? "invites, blocks and removes users, appoints administrators, changes the settings" : user.state === "active" ? "no · an ordinary user" : "no"}</span>
            </label>
          </dd>
          <dt>Appeared</dt>
          <dd>{user.appeared === "registered" ? `registered the organization · ${day(user.created_at)}` : `by the invitation of ${user.invited_by?.name ?? "someone"} · ${day(user.created_at)}`}</dd>
          <dt>Last sign-in</dt>
          <dd>{user.last_sign_in_at ? when(user.last_sign_in_at) : "never"}</dd>
          {user.state === "blocked" ? <><dt>Blocked</dt><dd>{when(user.changed_at)}{user.changed_by ? ` · by ${user.changed_by.name}` : ""} · cannot enter the organization until unblocked</dd></> : null}
          {user.state === "removed" ? <><dt>Removed</dt><dd>{when(user.changed_at)}{user.changed_by ? ` · by ${user.changed_by.name}` : ""}</dd></> : null}
          {invitedAgain ? (
            <><dt>Invited again</dt><dd><a className="lnk2" onClick={() => onOpenInvitation(invitedAgain.id)}>{when(invitedAgain.sent_at)}</a> · by {invitedAgain.invited_by.name}. Accepting makes a new user; this one stays in the history.</dd></>
          ) : null}
        </dl>
        {user.state === "blocked" ? <div className="hintb">A blocked person is unblocked, not invited: an invitation to {user.email} is refused.</div> : null}
      </div>
      <div className="df"><span>a user since {day(user.created_at)}</span><span>every change is a version of the user</span></div>
    </div>
  );
}
