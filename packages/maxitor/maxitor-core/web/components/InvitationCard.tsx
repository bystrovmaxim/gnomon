// packages/maxitor/maxitor-core/web/components/InvitationCard.tsx
// An invitation's card (mockup 9.9–9.11): its states, "Send the letter again" and "Withdraw" while it is sent, who
// sent it, when, until when it waits, and what became of it.
"use client";
import { Button } from "@maxitor/panel";
import { AdminDialog } from "./administration/AdminDialog";

import { RefusalText, STATE_WORDS, day, when } from "@/components/InviteDialog";
import { Icon } from "@/components/marks";
import type { Invitation, Refusal } from "@/lib/core";

export function InvitationCard({ invitation, organization, readOnly = false, sentAgain, refusal, busy, onClose, onResend, onWithdraw, onOpenUser }: {
  invitation: Invitation;
  readOnly?: boolean;
  organization: string;
  /** The letter went again in this visit: the button waits a minute. */
  sentAgain: boolean;
  refusal: Refusal | null;
  busy: boolean;
  onClose: () => void;
  onResend: () => void;
  onWithdraw: () => void;
  onOpenUser: (id: string) => void;
}) {
  const i = invitation;
  return (
    <AdminDialog title={`Invitation ${i.email}`} onClose={onClose}><div className="drawer admin-user-card">
      <div className="dh">
        <div className="dk"><span>Invitation · {organization}</span><Button type="button" variant="icon" className="close" aria-label="Close" onClick={onClose}>✕</Button></div>
        <h3>{i.email}</h3>
        <div className="dt">{i.state === "sent" ? "Will join as" : i.state === "accepted" ? "Joined as" : "Invited as"} {i.is_admin ? "an administrator" : "an ordinary user"}</div>
        <div className="admin-user-status"><span className={`stt st-${i.state}`}>{STATE_WORDS[i.state]}</span>
        {i.state === "sent" && !readOnly ? (
          <div className="acts">
            <Button type="button" variant="primary" disabled={busy || sentAgain} title={sentAgain ? "One letter a minute to one address" : undefined} onClick={onResend}><Icon.mail />Send the letter again</Button>
            <Button type="button" variant="danger" disabled={busy} onClick={onWithdraw}>Withdraw</Button>
          </div>
        ) : null}
        </div>
        {sentAgain && i.state === "sent" ? <div className="hintb"><b>The letter is sent again.</b> The next one can go in a minute: one address gets one letter a minute and ten an hour.</div> : null}
        {refusal ? <div style={{ marginTop: 10 }}><RefusalText refusal={refusal} organization={organization} admin /></div> : null}
      </div>
      <div className="db">
        <dl className="kv">
          <dt>Job title</dt><dd>{i.job_title || "Not specified"}</dd>
          <dt>Invited by</dt>
          <dd>{i.invited_by.name}</dd>
          <dt>Sent</dt>
          <dd>{when(i.sent_at)}{i.letter_sent_at !== i.sent_at ? <><br />letter sent again {when(i.letter_sent_at)}</> : null}</dd>
          {i.state === "sent" ? <><dt>Waits until</dt><dd>{day(i.expires_at)}</dd></> : null}
          {i.state === "accepted" ? <><dt>Accepted</dt><dd>{i.decided_at ? when(i.decided_at) : ""}{i.accepted_user ? <> · <Button type="button" variant="link" className="lnk2" onClick={() => onOpenUser(i.accepted_user!.id)}>{i.accepted_user.name}</Button></> : null}</dd></> : null}
          {i.state === "declined" ? <><dt>Declined</dt><dd>{i.decided_at ? when(i.decided_at) : ""}</dd></> : null}
          {i.state === "withdrawn" ? <><dt>Withdrawn</dt><dd>{i.decided_at ? when(i.decided_at) : ""}{i.by_setting ? " · by the setting “Who may invite”" : i.decided_by ? ` · by ${i.decided_by.name}` : ""}</dd></> : null}
          {i.state === "expired" ? <><dt>Expired</dt><dd>{day(i.expires_at)}</dd></> : null}
        </dl>
        {i.state === "sent" ? <div className="fine2">The person signs in to Maxitor with this email — an account that has it confirmed — and accepts or declines on the screen of their organizations. The letter holds no link.</div> : null}
        {i.state === "declined" || i.state === "withdrawn" || i.state === "expired" ? <div className="fine2">A new invitation to this email can be sent: only an invitation still sent stands in the way.</div> : null}
      </div>
    </div></AdminDialog>
  );
}
