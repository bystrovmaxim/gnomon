// packages/maxitor/maxitor-core/web/components/InvitationCard.tsx
// An invitation's card (mockup 9.9–9.11): its states, "Send the letter again" and "Withdraw" while it is sent, who
// sent it, when, until when it waits, and what became of it.
"use client";

import { RefusalText, STATE_WORDS, day, when } from "@/components/InviteDialog";
import { Icon } from "@/components/marks";
import type { Invitation, Refusal } from "@/lib/core";

export function InvitationCard({ invitation, organization, sentAgain, refusal, busy, onClose, onResend, onWithdraw, onOpenUser }: {
  invitation: Invitation;
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
    <div className="drawer" role="dialog" aria-label={`Invitation ${i.email}`}>
      <div className="dh">
        <div className="dk"><span>Invitation · {organization}</span><button type="button" className="close" aria-label="Close" onClick={onClose}>✕</button></div>
        <h3>{i.email}</h3>
        <div className="dt">{i.is_admin ? "will be an administrator" : "will be an ordinary user"}</div>
        <div className="life">{(Object.keys(STATE_WORDS) as Invitation["state"][]).map((k) => <span key={k} className={k === i.state ? "on" : ""}>{STATE_WORDS[k]}</span>)}</div>
        {i.state === "sent" ? (
          <div className="acts">
            <button type="button" className="btn2" disabled={busy || sentAgain} title={sentAgain ? "One letter a minute to one address" : undefined} onClick={onResend}><Icon.mail />Send the letter again</button>
            <button type="button" className="btn2 danger" disabled={busy} onClick={onWithdraw}>Withdraw</button>
          </div>
        ) : null}
        {sentAgain && i.state === "sent" ? <div className="hintb"><b>The letter is sent again.</b> The next one can go in a minute: one address gets one letter a minute and ten an hour.</div> : null}
        {refusal ? <div style={{ marginTop: 10 }}><RefusalText refusal={refusal} organization={organization} admin /></div> : null}
      </div>
      <div className="db">
        <dl className="kv">
          <dt>Invited by</dt>
          <dd>{i.invited_by.name}</dd>
          <dt>Sent</dt>
          <dd>{when(i.sent_at)}{i.letter_sent_at !== i.sent_at ? <><br />letter sent again {when(i.letter_sent_at)}</> : null}</dd>
          {i.state === "sent" ? <><dt>Waits until</dt><dd>{day(i.expires_at)}</dd></> : null}
          {i.state === "accepted" ? <><dt>Accepted</dt><dd>{i.decided_at ? when(i.decided_at) : ""}{i.accepted_user ? <> · <a className="lnk2" onClick={() => onOpenUser(i.accepted_user!.id)}>{i.accepted_user.name}</a></> : null}</dd></> : null}
          {i.state === "declined" ? <><dt>Declined</dt><dd>{i.decided_at ? when(i.decided_at) : ""}</dd></> : null}
          {i.state === "withdrawn" ? <><dt>Withdrawn</dt><dd>{i.decided_at ? when(i.decided_at) : ""}{i.by_setting ? " · by the setting “Who may invite”" : i.decided_by ? ` · by ${i.decided_by.name}` : ""}</dd></> : null}
          {i.state === "expired" ? <><dt>Expired</dt><dd>{day(i.expires_at)}</dd></> : null}
        </dl>
        {i.state === "sent" ? <div className="fine2">The person signs in to Maxitor with this email — an account that has it confirmed — and accepts or declines on the screen of their organizations. The letter holds no link.</div> : null}
        {i.state === "declined" || i.state === "withdrawn" || i.state === "expired" ? <div className="fine2">A new invitation to this email can be sent: only an invitation still sent stands in the way.</div> : null}
      </div>
      <div className="df"><span>{when(i.sent_at)}</span><span>every change is a version of the invitation</span></div>
    </div>
  );
}
