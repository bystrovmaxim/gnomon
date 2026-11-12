// packages/maxitor/maxitor-core/web/components/UsersPage.tsx
// Settings → Users (mockup 9.1–9.11, M15): the users' and the invitations' tabs with one search, "Invite", a row
// opening its card on the right, and the removal's confirmation. Every change goes to the backend and the row shows
// the answer; the page reads the lists again after an invitation is sent.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { blockUser, listUsers, removeUser, resendInvitation, setAdministrator, unblockUser, withdrawInvitation, type User } from "@/app/users";
import { Icon } from "@/components/marks";
import { InvitationCard } from "@/components/InvitationCard";
import { InviteDialog, STATE_WORDS, day, when } from "@/components/InviteDialog";
import { USER_STATES, UserCard } from "@/components/UserCard";
import type { Invitation, Refusal } from "@/lib/core";

type Tab = "users" | "invitations";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function UsersPage({ code, organization, me, initial, tab: firstTab, open }: {
  code: string;
  organization: string;
  /** The signed-in administrator's own user id. */
  me: string;
  initial: { users: User[]; invitations: Invitation[] };
  tab: Tab;
  /** A user's id the address asks to open. */
  open: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(firstTab);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState(initial.users);
  const [invitations, setInvitations] = useState(initial.invitations);
  const [userId, setUserId] = useState<string | null>(open);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<User | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [sentAgain, setSentAgain] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const live = users.filter((u) => u.state !== "removed");
  const gone = users.filter((u) => u.state === "removed");
  const pending = invitations.filter((i) => i.state === "sent").length;
  const activeAdministrators = users.filter((u) => u.is_admin && u.state === "active").length;
  const q = query.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);

  async function reload() {
    const answer = await listUsers(code);
    if ("refused" in answer) return router.refresh();
    setUsers(answer.users);
    setInvitations(answer.invitations);
  }

  function showUser(user: User) {
    setUsers((was) => was.map((u) => (u.id === user.id ? user : u)));
  }

  function showInvitation(invitation: Invitation) {
    setInvitations((was) => was.map((i) => (i.id === invitation.id ? invitation : i)));
  }

  async function change(call: () => Promise<{ user: User } | { refused: Refusal }>) {
    setBusy(true);
    const answer = await call();
    setBusy(false);
    if ("refused" in answer) return setRefusal(answer.refused);
    setRefusal(null);
    showUser(answer.user);
    setRemoving(null);
  }

  async function changeInvitation(call: () => Promise<{ invitation: Invitation } | { refused: Refusal }>, again = false) {
    setBusy(true);
    const answer = await call();
    setBusy(false);
    if ("refused" in answer) return setRefusal(answer.refused);
    setRefusal(null);
    showInvitation(answer.invitation);
    if (again) setSentAgain(answer.invitation.id);
  }

  function openUser(id: string) {
    setTab("users");
    setInvitationId(null);
    setRefusal(null);
    setUserId(id);
  }

  function openInvitation(id: string) {
    setTab("invitations");
    setUserId(null);
    setRefusal(null);
    setInvitationId(id);
  }

  const user = userId ? users.find((u) => u.id === userId) ?? null : null;
  const invitation = invitationId ? invitations.find((i) => i.id === invitationId) ?? null : null;

  const userRow = (u: User) => (
    <tr key={u.id} className={`click${u.id === userId ? " on" : ""}${u.state === "removed" ? " gone" : ""}`} onClick={() => openUser(u.id)} data-user={u.email}>
      <td>
        <div className="who"><span className="av">{initials(u.name)}</span><div><div className="nm">{u.name}{u.id === me ? <span className="mut" style={{ fontWeight: 400 }}> · you</span> : null}</div><div className="em">{u.email}</div></div></div>
      </td>
      <td><span className={`stt st-${u.state}`}>{USER_STATES[u.state]}</span></td>
      <td>{u.is_admin ? <span className="badge adm">administrator</span> : <span className="badge usr">user</span>}</td>
      <td className="mut wr">{u.appeared === "registered" ? `registered the organization · ${day(u.created_at)}` : `invited by ${u.invited_by?.name ?? "someone"} · ${day(u.created_at)}`}</td>
      <td className="mut">{u.state === "removed" ? `removed ${day(u.changed_at)}` : u.last_sign_in_at ? when(u.last_sign_in_at) : "never"}</td>
    </tr>
  );

  const invitationRow = (i: Invitation) => (
    <tr key={i.id} className={`click${i.id === invitationId ? " on" : ""}${i.state === "expired" || i.state === "withdrawn" ? " gone" : ""}`} onClick={() => openInvitation(i.id)} data-invitation={i.email}>
      <td className="nm wr">{i.email}</td>
      <td><span className={`stt st-${i.state}`}>{STATE_WORDS[i.state]}</span></td>
      <td>{i.is_admin ? <span className="badge adm">administrator</span> : <span className="badge usr">user</span>}</td>
      <td className="mut wr">{i.invited_by.name}</td>
      <td className="mut">{when(i.sent_at)}</td>
      <td className="mut wr">
        {i.state === "sent" ? `until ${day(i.expires_at)}` : null}
        {i.state === "accepted" ? <>accepted {i.decided_at ? when(i.decided_at) : ""}{i.accepted_user ? <> · <a className="lnk2" onClick={(e) => { e.stopPropagation(); openUser(i.accepted_user!.id); }}>{i.accepted_user.name}</a></> : null}</> : null}
        {i.state === "declined" ? `declined ${i.decided_at ? when(i.decided_at) : ""}` : null}
        {i.state === "withdrawn" ? `withdrawn ${i.decided_at ? when(i.decided_at) : ""}${i.by_setting ? " · by the setting" : i.decided_by ? ` · by ${i.decided_by.name}` : ""}` : null}
        {i.state === "expired" ? `expired ${day(i.expires_at)}` : null}
      </td>
      <td>
        {i.state === "sent" ? (
          <div className="acts2">
            <button type="button" className="btn2" disabled={busy || sentAgain === i.id} onClick={(e) => { e.stopPropagation(); openInvitation(i.id); void changeInvitation(() => resendInvitation(code, i.id), true); }}>Send again</button>
            <button type="button" className="btn2 danger" disabled={busy} onClick={(e) => { e.stopPropagation(); openInvitation(i.id); void changeInvitation(() => withdrawInvitation(code, i.id)); }}>Withdraw</button>
          </div>
        ) : null}
      </td>
    </tr>
  );

  const columns = <colgroup><col style={{ width: "34%" }} /><col style={{ width: "11%" }} /><col style={{ width: "13%" }} /><col style={{ width: "28%" }} /><col style={{ width: "14%" }} /></colgroup>;

  return (
    <div className="page">
      <div className="inner">
        <div className="ph">
          <div className="tx">
            <h2>Users</h2>
            <div className="sub">Who works in {organization} and who is invited. An invited person becomes a user once they sign in with the invited email and accept.</div>
          </div>
          <button type="button" className="btn2 pri" onClick={() => setInviting(true)}><Icon.mail />Invite</button>
        </div>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "users"} className={tab === "users" ? "on" : ""} onClick={() => { setTab("users"); setInvitationId(null); }}>Users<span className="cnt">{live.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === "invitations"} className={tab === "invitations" ? "on" : ""} onClick={() => { setTab("invitations"); setUserId(null); }}>Invitations<span className="cnt">{pending}</span></button>
        </div>
        <label className="search">
          <Icon.search />
          <input type="search" placeholder={tab === "users" ? "Find by name or email" : "Find by email"} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={tab === "users" ? "Find by name or email" : "Find by email"} />
          {query ? <button type="button" className="clr" aria-label="Clear the search" onClick={() => setQuery("")}><Icon.x /></button> : null}
        </label>
        {tab === "users" ? (
          <>
            <table className="utbl">{columns}<thead><tr><th>User</th><th>State</th><th>Role</th><th>Appeared</th><th>Last sign-in</th></tr></thead><tbody>{live.filter((u) => matches(`${u.name} ${u.email}`)).map(userRow)}</tbody></table>
            {gone.filter((u) => matches(`${u.name} ${u.email}`)).length ? (
              <>
                <div className="sec">Removed <span>— kept in the history; a removed person can be invited again</span></div>
                <table className="utbl">{columns}<tbody>{gone.filter((u) => matches(`${u.name} ${u.email}`)).map(userRow)}</tbody></table>
              </>
            ) : null}
          </>
        ) : (
          <>
            <table className="utbl"><thead><tr><th>Email</th><th>State</th><th>Will be</th><th>Invited by</th><th>Sent</th><th>Then</th><th></th></tr></thead><tbody>{invitations.filter((i) => matches(i.email)).map(invitationRow)}</tbody></table>
            {invitations.length === 0 ? <div className="empty-st">No invitation yet. “Invite” sends the first one.</div> : null}
          </>
        )}
      </div>
      {user ? (
        <UserCard
          user={user}
          me={me}
          organization={organization}
          invitedAgain={user.state === "removed" ? invitations.find((i) => i.state === "sent" && i.email === user.email) ?? null : null}
          last={user.is_admin && user.state === "active" && activeAdministrators === 1}
          refusal={refusal}
          busy={busy}
          onClose={() => { setUserId(null); setRefusal(null); }}
          onBlock={() => void change(() => blockUser(code, user.id))}
          onUnblock={() => void change(() => unblockUser(code, user.id))}
          onRemove={() => setRemoving(user)}
          onMark={(isAdmin) => void change(() => setAdministrator(code, user.id, isAdmin))}
          onOpenInvitation={openInvitation}
        />
      ) : null}
      {invitation ? (
        <InvitationCard
          invitation={invitation}
          organization={organization}
          sentAgain={sentAgain === invitation.id}
          refusal={refusal}
          busy={busy}
          onClose={() => { setInvitationId(null); setRefusal(null); }}
          onResend={() => void changeInvitation(() => resendInvitation(code, invitation.id), true)}
          onWithdraw={() => void changeInvitation(() => withdrawInvitation(code, invitation.id))}
          onOpenUser={openUser}
        />
      ) : null}
      {inviting ? (
        <InviteDialog
          code={code}
          organization={organization}
          admin
          onClose={() => setInviting(false)}
          onSent={(sent) => { setInviting(false); void reload().then(() => openInvitation(sent.id)); }}
          onOpenUser={(id) => { setInviting(false); openUser(id); }}
        />
      ) : null}
      {removing ? (
        <>
          <div className="scrim" onClick={() => setRemoving(null)} />
          <div className="dlg" role="dialog" aria-label={`Remove ${removing.name}?`}>
            <h3>Remove {removing.name} from {organization}?</h3>
            <div className="sub"><b>{removing.email}</b>. “Removed” is final: the person cannot enter the organization and this user cannot be brought back. The user stays in the history as it was.</div>
            <div className="hintb">The person may be invited again later: accepting then makes a new user of the same account.</div>
            <div className="ft">
              <button type="button" className="btn2" onClick={() => setRemoving(null)}>Cancel</button>
              <button type="button" className="btn2 dangerf" disabled={busy} onClick={() => void change(() => removeUser(code, removing.id))}>Remove</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
