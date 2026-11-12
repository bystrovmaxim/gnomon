// packages/maxitor/maxitor-core/web/components/OrganizationPage.tsx
// Settings → Organization (mockup 10.1–10.3): the name and the address, the setting "Who may invite" as two choices,
// the confirmation that names what a switch to administrators withdraws, and the notice after it.
"use client";

import { useState } from "react";

import { setWhoMayInvite, type Settings } from "@/app/users";
import { Alert } from "@/components/fields";
import { Icon } from "@/components/marks";
import { day, when } from "@/components/InviteDialog";
import type { Invitation, Refusal } from "@/lib/core";

export function OrganizationPage({ code, initial }: { code: string; initial: Settings }) {
  const [settings, setSettings] = useState(initial);
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
    <div className="page">
      <div className="inner">
        <div className="ph">
          <div className="tx">
            <h2>Organization</h2>
            <div className="sub"><b>{settings.name}</b> · maxitor.aoa.run/w/{settings.code}. The name and the address were set at registration; the address cannot be changed.</div>
          </div>
        </div>
        <div className="sec">Who may invite</div>
        {refusal ? <Alert kind="bad">The setting was not changed ({refusal.error}).</Alert> : null}
        {withdrawn && switchedAt ? (
          <Alert kind="ok">
            <b>Administrators only since {when(switchedAt)}.</b>{" "}
            {withdrawn.length
              ? `${withdrawn.length} ${withdrawn.length === 1 ? "invitation" : "invitations"} sent by ordinary users ${withdrawn.length === 1 ? "was" : "were"} withdrawn: ${withdrawn.map((i) => `${i.email} (by ${i.invited_by.name})`).join(", ")}. `
              : "No invitation of an ordinary user was waiting, so nothing was withdrawn. "}
            <a className="lnk" href={`/w/${code}/core/settings/users?tab=invitations`}>See the invitations</a>.
          </Alert>
        ) : null}
        <div className={`choice${any ? " on" : ""}`} role="radio" aria-checked={any} tabIndex={0} onClick={() => { if (!any && !busy) void choose("any_user"); }}>
          <span className="rad" />
          <div>
            <b>Any user of the organization</b>
            <div>Every active user invites ordinary users from the menu under their icon. Administrators also invite administrators, here in Settings. This is how an organization starts.</div>
            {any ? <div className="now">Chosen</div> : null}
          </div>
        </div>
        <div className={`choice${any ? "" : " on"}`} role="radio" aria-checked={!any} tabIndex={0} onClick={() => { if (any && !busy) setAsking(true); }}>
          <span className="rad" />
          <div>
            <b>Administrators only</b>
            <div>An ordinary user cannot invite. Switching to this withdraws every invitation not yet accepted that an ordinary user sent; invitations administrators sent stay.</div>
            {any ? null : <div className="now">Chosen</div>}
          </div>
        </div>
        <div className="fine2">Only an administrator changes this, and the server checks it on every invitation — also one that does not come from the screen.</div>
        <div className="sec">Invitations <span>— how long they wait</span></div>
        <div className="orgkv">
          <dl className="kv">
            <dt>Lifetime</dt>
            <dd>{settings.invitation_days} days — <code className="mono">MAXITOR_INVITATION_DAYS</code>, a setting of the core, the same for every organization</dd>
            <dt>Limits</dt>
            <dd>one email: one letter a minute, ten an hour · one inviter: thirty an hour · the organization: a hundred a day</dd>
          </dl>
        </div>
      </div>
      {asking ? (
        <>
          <div className="scrim" onClick={() => setAsking(false)} />
          <div className="dlg" role="dialog" aria-label="Administrators only?">
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
              <button type="button" className="btn2" onClick={() => setAsking(false)}>Cancel</button>
              <button type="button" className="btn2 pri" disabled={busy} onClick={() => void choose("administrators")}>Switch{pending.length ? ` and withdraw ${pending.length}` : ""}</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
