// packages/maxitor/maxitor-core/web/components/OrganizationPage.tsx
// Organization cards expose the current policy; editing retains the withdrawal confirmation.
"use client";
import { Button } from "@maxitor/panel";
import { AdminDialog } from "./administration/AdminDialog";

import { useState } from "react";
import { useOpenPanel } from "@maxitor/panel";

import { setWhoMayInvite, type Settings } from "@/app/users";
import { Alert } from "@/components/fields";
import { Icon } from "@/components/marks";
import { day, when } from "@/components/InviteDialog";
import type { Invitation, Refusal } from "@/lib/core";

export function OrganizationPage({ code, initial }: { code: string; initial: Settings }) {
  const openPanel = useOpenPanel();
  const [settings, setSettings] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial.who_may_invite);
  const [asking, setAsking] = useState(false);
  const [withdrawn, setWithdrawn] = useState<Invitation[] | null>(null);
  const [switchedAt, setSwitchedAt] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const any = settings.who_may_invite === "any_user";

  async function choose(value: "any_user" | "administrators") {
    setBusy(true);
    const answer = await setWhoMayInvite(code, value);
    setBusy(false);
    setAsking(false);
    if ("refused" in answer) return setRefusal(answer.refused);
    setRefusal(null);
    setEditing(false);
    setSettings({ ...settings, who_may_invite: value, pending_by_users: value === "administrators" ? [] : settings.pending_by_users });
    if (value === "administrators") {
      setWithdrawn(answer.withdrawn);
      setSwitchedAt(new Date().toISOString());
    } else {
      setWithdrawn(null);
      setSwitchedAt(null);
    }
  }

  const pending = settings.pending_by_users;
  return (
    <div className="page organization-page">
      <div className="inner" data-room-anchor={`organization:${code}`}>
        <section className="admin-surface" aria-label="Organization details">
          <header className="admin-surface-head"><h3>Organization details</h3></header>
          <dl className="admin-facts"><div><dt>Name</dt><dd>{settings.name}</dd></div><div><dt>Address</dt><dd>/w/{settings.code}</dd></div></dl>
        </section>
        {refusal ? <Alert kind="bad">The setting was not changed ({refusal.error}).</Alert> : null}
        {withdrawn && switchedAt ? (
          <Alert kind="ok">
            <b>Administrators only since {when(switchedAt)}.</b>{" "}
            {withdrawn.length
              ? `${withdrawn.length} ${withdrawn.length === 1 ? "invitation" : "invitations"} sent by ordinary users ${withdrawn.length === 1 ? "was" : "were"} withdrawn: ${withdrawn.map((i) => `${i.email} (by ${i.invited_by.name})`).join(", ")}. `
              : "No invitation of an ordinary user was waiting, so nothing was withdrawn. "}
            <Button variant="link" className="lnk" type="button" onClick={() => openPanel("core", "/settings/users", { tab: "history" })}>See invitation history</Button>.
          </Alert>
        ) : null}
        <section className="admin-surface" aria-label="Invitation policy">
          <header className="admin-surface-head"><h3>Invitation policy</h3><Button type="button" variant="primary" onClick={() => { setDraft(settings.who_may_invite); setEditing(true); }}>Edit</Button></header>
          <dl className="admin-facts"><div><dt>Who may invite</dt><dd>{any ? "Any user of the organization" : "Administrators only"}</dd></div></dl>
          <p className="fine2">Only administrators can change this policy.</p>
        </section>
        <section className="admin-surface" aria-label="Invitation limits">
          <header className="admin-surface-head"><h3>Invitation limits</h3></header>
          <dl className="admin-facts">
            <div><dt>Lifetime</dt><dd>{settings.invitation_days} days</dd></div>
            <div><dt>Per email</dt><dd>One letter a minute, ten an hour</dd></div>
            <div><dt>Per inviter</dt><dd>Thirty an hour</dd></div>
            <div><dt>Organization</dt><dd>A hundred a day</dd></div>
          </dl>
        </section>
      </div>
      {editing && !asking ? (
        <AdminDialog title="Invitation policy" onClose={() => { if (!busy) setEditing(false); }}>
          <div className="dlg">
            <h3>Invitation policy</h3>
            <fieldset className="admin-policy-options" disabled={busy}>
              <legend className="fine2">Who may invite</legend>
              <label className={`choice${draft === "any_user" ? " on" : ""}`}><input type="radio" name="invitation-policy" checked={draft === "any_user"} onChange={() => setDraft("any_user")} /><span><b>Any user of the organization</b><span className="admin-choice-description">May invite users. Only administrators may invite administrators.</span></span></label>
              <label className={`choice${draft === "administrators" ? " on" : ""}`}><input type="radio" name="invitation-policy" checked={draft === "administrators"} onChange={() => setDraft("administrators")} /><span><b>Administrators only</b><span className="admin-choice-description">Only administrators may invite. Switching to this policy withdraws pending invitations sent by other users; existing members keep access.</span></span></label>
            </fieldset>
            {refusal ? <Alert kind="bad">The setting was not changed ({refusal.error}).</Alert> : null}
            <div className="ft"><Button type="button" variant="secondary" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button><Button type="button" variant="primary" disabled={busy || draft === settings.who_may_invite} onClick={() => { if (draft === "administrators") setAsking(true); else void choose("any_user"); }}>Save</Button></div>
          </div>
        </AdminDialog>
      ) : null}
      {asking ? (
        <AdminDialog title="Administrators only?" onClose={() => setAsking(false)}>
          <div className="dlg">
            <h3>Administrators only?</h3>
            <div className="sub">
              From now on an ordinary user of {settings.name} cannot invite.{" "}
              {pending.length ? `${pending.length === 1 ? "This invitation is" : "These invitations are"} withdrawn at once and cannot be accepted any more:` : "No invitation of an ordinary user is waiting, so nothing is withdrawn."}
            </div>
            {pending.map((i) => (
              <div className="arow" key={i.id}>
                <Icon.mail />
                <div className="an">{i.email}<div className="as">sent by {i.invited_by.name}, {when(i.sent_at)} · waiting until {day(i.expires_at)}</div></div>
                <span className="ad">withdrawn</span>
              </div>
            ))}
            <div className="fine2">Invitations sent by administrators stay as they are. Users who already accepted stay too.</div>
            <div className="ft">
              <Button type="button" variant="secondary" onClick={() => setAsking(false)}>Cancel</Button>
              <Button type="button" variant="primary" disabled={busy} onClick={() => void choose("administrators")}>Switch{pending.length ? ` and withdraw ${pending.length}` : ""}</Button>
            </div>
          </div>
        </AdminDialog>
      ) : null}
    </div>
  );
}
