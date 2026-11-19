// packages/maxitor/maxitor-core/web/components/InviteDialog.tsx
// "Invite to <organization>" (mockup 8.1–8.8, 9.12, M14): the email; for an administrator the mark "Organization
// administrator", off when the form opens; for an ordinary user no mark and the invitations they sent under the form,
// with "Send again" on those still sent. Every refusal of the backend is said as the mockup words it.
"use client";
import { Button } from "@maxitor/panel";
import { AdminDialog } from "./administration/AdminDialog";

import { useEffect, useState } from "react";

import { listMyInvitations, resendInvitation, sendInvitation } from "@/app/users";
import { Alert, Field } from "@/components/fields";
import { Icon } from "@/components/marks";
import type { Invitation, Refusal } from "@/lib/core";

export const STATE_WORDS: Record<Invitation["state"], string> = {
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const LIMITS: Record<string, string> = {
  "address per minute": "One address gets one letter of invitation a minute",
  "address per hour": "One address gets ten letters of invitation an hour",
  "inviter per hour": "One person sends at most thirty invitations an hour",
  "organization per day": "One organization sends at most a hundred invitations a day",
};

/** What the backend's refusal means on the form, as the mockup words it. */
export function RefusalText({ refusal, organization, admin, onOpenUser, onResend }: {
  refusal: Refusal;
  organization: string;
  admin: boolean;
  onOpenUser?: (userId: string) => void;
  onResend?: (invitationId: string) => void;
}) {
  const name = String(refusal.name ?? "this person");
  switch (refusal.error) {
    case "administrators_only":
      return <Alert kind="warn"><b>Only administrators invite in {organization} now.</b> The setting changed a moment ago. Ask an administrator to send the invitation.</Alert>;
    case "administrator_mark":
      return <Alert kind="warn"><b>Only an administrator invites an administrator.</b> The person becomes an ordinary user.</Alert>;
    case "already_user":
      return refusal.state === "blocked" ? (
        <Alert kind="warn">
          <b>{name} is blocked</b> with this email. A blocked person is unblocked, not invited.{" "}
          {admin && onOpenUser ? <a className="lnk" onClick={() => onOpenUser(String(refusal.user_id))}>Open their card</a> : "Ask an administrator."}
        </Alert>
      ) : (
        <Alert kind="bad"><b>{name} already works here</b> with this email. Nothing to send.</Alert>
      );
    case "already_invited":
      return (
        <Alert kind="info">
          <b>An invitation to this email is already sent</b> and waiting. Only its letter can go again.
          {onResend && refusal.invitation_id ? <> <a className="lnk" onClick={() => onResend(String(refusal.invitation_id))}>Send the letter again</a>.</> : null}
        </Alert>
      );
    case "too_many_invitations": {
      const until = refusal.until ? new Date(String(refusal.until)).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
      return <Alert kind="warn"><b>Too many invitations.</b> {LIMITS[String(refusal.limit)] ?? String(refusal.limit)}{until ? <>; the next one can go at <b>{until}</b></> : null}.</Alert>;
    }
    case "not_sent":
      return <Alert kind="info">This invitation is no longer sent: it is {STATE_WORDS[String(refusal.state) as Invitation["state"]]?.toLowerCase() ?? "decided"}.</Alert>;
    case "mail_not_sent":
      return <Alert kind="bad"><b>The letter could not be sent.</b> Nothing was created; try again in a minute.</Alert>;
    default:
      return <Alert kind="bad">The invitation was not sent ({refusal.error}).</Alert>;
  }
}

export function InviteDialog({ code, organization, admin, onClose, onSent, onOpenUser }: {
  code: string;
  organization: string;
  /** The person is an administrator: the mark is offered, and a blocked person's card can be opened. */
  admin: boolean;
  onClose: () => void;
  /** An administrator's page takes the new invitation; the menu's dialog shows it under the form instead. */
  onSent?: (invitation: Invitation) => void;
  onOpenUser?: (userId: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [mark, setMark] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [sent, setSent] = useState<Invitation | null>(null);
  const [mine, setMine] = useState<Invitation[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadMine() {
    setMine(await listMyInvitations(code));
  }
  useEffect(() => {
    if (!onSent) void loadMine();
    // The list of the person's own invitations stands under the menu's dialog alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    setBusy(true);
    const answer = await sendInvitation(code, email, admin && mark, jobTitle);
    setBusy(false);
    if ("refused" in answer) return setRefusal(answer.refused);
    setRefusal(null);
    if (onSent) return onSent(answer.invitation);
    setSent(answer.invitation);
    setEmail("");
    setMark(false);
    setJobTitle("");
    await loadMine();
  }

  async function resend(invitationId: string) {
    setBusy(true);
    const answer = await resendInvitation(code, invitationId);
    setBusy(false);
    if ("refused" in answer) return setRefusal(answer.refused);
    setRefusal(null);
    setSent(answer.invitation);
    if (!onSent) await loadMine();
  }

  return (
    <AdminDialog title={`Invite to ${organization}`} onClose={onClose}>
      <div className="dlg sheet">
        <div className="grab" aria-hidden="true" />
        <h3>Invite to {organization}</h3>
        <div className="sub">A letter names you and the organization and asks the person to sign in to Maxitor with this email. It holds no link.</div>
        {sent ? <Alert kind="ok"><b>The invitation is sent to {sent.email}.</b> It waits until {day(sent.expires_at)}.</Alert> : null}
        {refusal ? <RefusalText refusal={refusal} organization={organization} admin={admin} onOpenUser={onOpenUser} onResend={(id) => void resend(id)} /> : null}
        <Field label="Email" type="email" value={email} onChange={(v) => { setEmail(v); setRefusal(null); }} autoComplete="off" autoFocus bad={refusal?.error === "already_user" || refusal?.error === "already_invited"} />
        <Field label="Job title (optional)" maxLength={160} value={jobTitle} onChange={setJobTitle} autoComplete="organization-title" />
        {admin ? (
          <label className="arow" style={{ cursor: "pointer" }}>
            <div className="an">Organization administrator<div className="as">invites and blocks users, appoints administrators and changes the organization’s settings</div></div>
            <input type="checkbox" className="switch" checked={mark} onChange={(e) => setMark(e.target.checked)} aria-label="Organization administrator" />
          </label>
        ) : (
          <div className="fine2" style={{ margin: "-4px 0 10px" }}>The person becomes an ordinary user. Only an administrator invites an administrator.</div>
        )}
        {admin && mark ? <div className="hintb warn2">Can invite and block users and appoint other administrators.</div> : null}
        {mine && mine.length ? (
          <>
            <div className="dsec">Sent by you</div>
            {mine.map((i) => (
              <div className="arow" key={i.id}>
                <Icon.mail />
                <div className="an">{i.email}<div className="as">{STATE_WORDS[i.state]} · {i.state === "sent" ? `until ${day(i.expires_at)}` : i.state === "accepted" && i.accepted_user ? `${when(i.decided_at ?? i.sent_at)} · now ${i.accepted_user.name}` : i.decided_at ? when(i.decided_at) : ""}</div></div>
                {i.state === "sent" ? <Button type="button" variant="primary" disabled={busy} onClick={() => void resend(i.id)}>Send again</Button> : null}
              </div>
            ))}
          </>
        ) : null}
        <div className="ft">
          <Button type="button" variant="secondary" onClick={onClose}>{sent ? "Done" : "Cancel"}</Button>
          <Button type="button" variant="primary" disabled={busy || !email.includes("@")} onClick={() => void send()}><Icon.mail />Send the invitation</Button>
        </div>
      </div>
    </AdminDialog>
  );
}
