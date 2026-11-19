// packages/maxitor/maxitor-core/web/components/UsersPage.tsx
// Settings → Users (mockup 9.1–9.11, M15): the users' and the invitations' tabs with one search, "Invite", a row
// opening its card on the right. Every change goes to the backend and the row shows
// the answer; the page reads the lists again after an invitation is sent.
"use client";
import { Button } from "@maxitor/panel";

import { usePanelQuery, usePanelRouter } from "@maxitor/panel";
import { useRouter } from "next/navigation";
import { useState, useEffect, useContext } from "react";

import { blockUser, listUsers, resendInvitation, setAdministrator, setJobTitle, unblockUser, withdrawInvitation, type User } from "@/app/users";
import { AdministrationActions, AdministrationComparison } from "./administration/AdministrationPanel";
import { invitationLists, snapshotUser, snapshotInvitation } from "./administration/compare";
import { useAdministrationLayers } from "./administration/AdministrationLayers";
import { DirectoryToolbar } from "./administration/DirectoryToolbar";
import { UserTable } from "./administration/UserTable";
import { Icon } from "@/components/marks";
import { InvitationCard } from "@/components/InvitationCard";
import { InviteDialog, STATE_WORDS, day, when } from "@/components/InviteDialog";
import { USER_STATES, UserCard } from "@/components/UserCard";
import type { Invitation, Refusal } from "@/lib/core";

type Tab = "users" | "invitations" | "history";

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
  const comparison = useContext(AdministrationComparison);
  const readOnly = comparison?.historical ?? false;
  const router = useRouter();
  const panelQuery = Object.fromEntries(Object.entries(usePanelQuery()).filter(([key]) => key !== "at" && !key.startsWith("_")));
  const panelRouter = usePanelRouter();
  const tab: Tab = panelQuery.tab === "history" ? "history" : panelQuery.tab === "invitations" ? "invitations" : "users";
  const setTab = (value: Tab) => panelRouter.push({ query: { ...panelQuery, tab: value } });
  const query = panelQuery.search ?? "";
  const setQuery = (value: string) => panelRouter.replace({ query: { ...panelQuery, search: value } });
  const [liveUsers, setUsers] = useState(initial.users);
  const [liveInvitations, setInvitations] = useState(initial.invitations);
  const [userId, setUserId] = useState<string | null>(open);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  useEffect(() => { if (tab === "users") setInvitationId(null); else setUserId(null); }, [tab]);
  const setActions = useContext(AdministrationActions);
  useEffect(() => {
    if (readOnly) return;
    setActions([{ title: "Invite", icon: "plus", onClick: () => setInviting(true) }]);
    return () => setActions([]);
  }, [setActions, readOnly]);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [sentAgain, setSentAgain] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setUsers(initial.users); setInvitations(initial.invitations); }, [initial]);

  const invitations = readOnly && tab !== "users" ? comparison.entries.map(entry => snapshotInvitation(entry.row)) : liveInvitations;
  const users = readOnly && tab === "users" ? comparison.entries.map(entry => snapshotUser(entry.row)) : liveUsers;
  const changes = new Map(comparison?.entries.map(entry => [entry.row.id, entry]) ?? []);
  const activeAdministrators = users.filter((u) => u.is_admin && u.state === "active").length;
  const q = query.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  const visibleUsers = users.filter(u => matches(`${u.name} ${u.email}`));
  const lists = invitationLists(invitations, query);
  useAdministrationLayers({ param: "tab", label: "People views", default: "users", options: [
    { value: "users", label: "Users", count: !readOnly || tab === "users" ? visibleUsers.length : undefined },
    { value: "invitations", label: "Invitations", count: !readOnly ? lists.pending.length : undefined },
    { value: "history", label: "History", count: !readOnly ? lists.history.length : undefined },
  ] });

  const visibleInvitations = tab === "history" ? lists.history : lists.pending;

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
    if (tab !== "users") setTab("users");
    setInvitationId(null);
    setRefusal(null);
    setUserId(id);
  }

  function openInvitation(id: string) {
    setUserId(null);
    setRefusal(null);
    setInvitationId(id);
  }

  const user = userId ? users.find((u) => u.id === userId) ?? null : null;
  const invitation = invitationId ? invitations.find((i) => i.id === invitationId) ?? null : null;

  const userRow = (u: User) => (
    <tr key={u.id} className={`click${u.id === userId ? " on" : ""}`} onClick={() => openUser(u.id)} data-user={u.email} data-change={comparison?.compared ? changes.get(u.id)?.kind : undefined}>
      <td>
        <div className="who" data-room-anchor={`users:${u.id}`}><span className="av">{initials(u.name)}</span><div><div className="nm"><Button type="button" variant="link" className="admin-person-link" aria-label={`Open user ${u.name}`} onClick={(event) => { event.stopPropagation(); openUser(u.id); }}>{u.name}</Button>{u.id === me ? <span className="mut" style={{ fontWeight: 400 }}> · you</span> : null}</div><div className="em">{u.email}</div></div></div>
      </td>
      <td className="wr" data-label="Job title">{u.job_title || "—"}</td>
      <td><span className={`stt st-${u.state}`}>{USER_STATES[u.state]}</span></td>
      <td>{u.is_admin ? <span className="badge adm">administrator</span> : <span className="badge usr">user</span>}</td>
      <td className="mut wr" data-label="Appeared">{!u.created_at ? "Not recorded" : u.appeared === "registered" ? `registered the organization · ${day(u.created_at)}` : `invited by ${u.invited_by?.name ?? "someone"} · ${day(u.created_at)}`}</td>
      <td className="mut" data-label="Last sign-in">{readOnly ? "Not recorded in history" : u.last_sign_in_at ? when(u.last_sign_in_at) : "never"}</td>
    </tr>
  );

  const invitationRow = (i: Invitation) => (
    <tr key={i.id} className={`click${i.id === invitationId ? " on" : ""}${i.state === "expired" || i.state === "withdrawn" ? " gone" : ""}`} onClick={() => openInvitation(i.id)} data-change={comparison?.compared ? changes.get(i.id)?.kind : undefined} data-invitation={i.email}>
      <td className="nm wr" data-room-anchor={`invitations:${i.id}`}>{i.accepted_user ? <div className="nm">{i.accepted_user.name}</div> : null}<Button type="button" variant="link" className="admin-person-link" aria-label={`Open invitation ${i.email}`} onClick={(event) => { event.stopPropagation(); openInvitation(i.id); }}>{i.email}</Button></td>
      <td><span className={`stt st-${i.state}`}>{STATE_WORDS[i.state]}</span></td>
      <td>{i.is_admin ? <span className="badge adm">administrator</span> : <span className="badge usr">user</span>}</td>
      <td className="mut wr" data-label="Invited by">{i.invited_by.name}</td>
      <td className="mut" data-label="Sent">{when(i.sent_at)}</td>
      <td className="mut wr" data-label="Then">
        {i.state === "sent" ? `until ${day(i.expires_at)}` : null}
        {i.state === "accepted" ? <>accepted {i.decided_at ? when(i.decided_at) : ""}{i.accepted_user ? <> · <Button type="button" variant="link" className="lnk2" onClick={(e) => { e.stopPropagation(); openUser(i.accepted_user!.id); }}>{i.accepted_user.name}</Button></> : null}</> : null}
        {i.state === "declined" ? `declined ${i.decided_at ? when(i.decided_at) : ""}` : null}
        {i.state === "withdrawn" ? `withdrawn ${i.decided_at ? when(i.decided_at) : ""}${i.by_setting ? " · by the setting" : i.decided_by ? ` · by ${i.decided_by.name}` : ""}` : null}
        {i.state === "expired" ? `expired ${day(i.expires_at)}` : null}
      </td>
      <td>
        {i.state === "sent" && !readOnly ? (
          <div className="acts2">
            <Button type="button" variant="primary" disabled={busy || sentAgain === i.id} onClick={(e) => { e.stopPropagation(); openInvitation(i.id); void changeInvitation(() => resendInvitation(code, i.id), true); }}>Send again</Button>
            <Button type="button" variant="danger" disabled={busy} onClick={(e) => { e.stopPropagation(); openInvitation(i.id); void changeInvitation(() => withdrawInvitation(code, i.id)); }}>Withdraw</Button>
          </div>
        ) : null}
      </td>
    </tr>
  );

  const columns = <colgroup><col style={{ width: "var(--user-identity-width, 26%)" }} /><col style={{ width: "20%" }} /><col style={{ width: "10%" }} /><col style={{ width: "12%" }} /><col style={{ width: "var(--user-appeared-width, 20%)" }} /><col style={{ width: "12%" }} /></colgroup>;

  return (
    <div className="page people-page">
      <div className="inner">
        <DirectoryToolbar>
        <label className="search">
          <Icon.search />
          <input type="search" placeholder={tab === "users" ? "Find by name or email" : "Find by email"} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={tab === "users" ? "Find by name or email" : "Find by email"} />
          {query ? <Button type="button" variant="icon" className="clr" aria-label="Clear the search" onClick={() => setQuery("")}><Icon.x /></Button> : null}
        </label></DirectoryToolbar>
        <section className="admin-surface admin-people" id="people-list" aria-label="People directory">
        {visibleUsers.length === 0 && tab === "users" ? <p role="status">No users match this view.</p> : null}
        {tab === "users" ? (
          <UserTable>{columns}<thead><tr><th>User</th><th>Job title</th><th>State</th><th>Role</th><th>Appeared</th><th>Last sign-in</th></tr></thead><tbody>{visibleUsers.map(userRow)}</tbody></UserTable>
        ) : (
          <>
            <UserTable><colgroup><col style={{ width: "180px" }} /><col style={{width:"100px"}} /><col style={{width:"130px"}} /><col style={{width:"150px"}} /><col style={{width:"140px"}} /><col style={{width:"220px"}} /><col style={{width:"200px"}} /></colgroup><thead><tr><th>Email</th><th>State</th><th>Invited role</th><th>Invited by</th><th>Sent</th><th>Then</th><th></th></tr></thead><tbody>{visibleInvitations.map(invitationRow)}</tbody></UserTable>
            {visibleInvitations.length === 0 ? <div className="empty-st">{query ? "No invitations match this search." : tab === "history" ? "No completed invitations yet." : "No invitations awaiting a response."}</div> : null}
          </>
        )}
        </section>
      </div>
      {user ? (
        <UserCard
          key={user.id}
          user={user}
          readOnly={readOnly}
          changeKind={comparison?.compared ? changes.get(user.id)?.kind : undefined}
          me={me}
          organization={organization}
          last={user.is_admin && user.state === "active" && activeAdministrators === 1}
          refusal={refusal}
          busy={busy}
          onClose={() => { setUserId(null); setRefusal(null); }}
          onBlock={() => void change(() => blockUser(code, user.id))}
          onUnblock={() => void change(() => unblockUser(code, user.id))}
          onJobTitle={(title) => change(() => setJobTitle(code, user.id, title))}
          onMark={(isAdmin) => void change(() => setAdministrator(code, user.id, isAdmin))}
        />
      ) : null}
      {invitation ? (
        <InvitationCard
          invitation={invitation}
          readOnly={readOnly}
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
    </div>
  );
}
