// packages/maxitor/maxitor-core/web/components/InvitationChoice.tsx
// One invitation on the screen of choosing an organization (mockup 8.10, 8.14, M13): the organization, who invites,
// as what and until when; Accept opens the organization, Decline says so on the same screen.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { acceptInvitation, declineInvitation } from "@/app/actions";
import { Icon } from "@/components/marks";
import { colorOf } from "@/lib/colors";
import type { WaitingInvitation } from "@/lib/core";

export function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function InvitationChoice({ invitation }: { invitation: WaitingInvitation }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    const answer = await acceptInvitation(invitation.id);
    setBusy(false);
    if (answer && "refused" in answer) {
      setProblem(answer.refused.error === "policy" ? "Accept the privacy policy first: sign out and in again." : "This invitation no longer works.");
      router.refresh();
    }
  }

  async function decline() {
    setBusy(true);
    const answer = await declineInvitation(invitation.id);
    setBusy(false);
    if ("refused" in answer) {
      setProblem("This invitation no longer works.");
      router.refresh();
      return;
    }
    router.replace(`/w?declined=${encodeURIComponent(invitation.organization.name)}`);
    router.refresh();
  }

  return (
    <div className="orow inv" data-invitation={invitation.id}>
      <span className="oa" style={{ background: colorOf(invitation.organization.code) }}>{invitation.organization.name[0]}</span>
      <div className="on">
        <b>{invitation.organization.name}</b>
        <div>
          {invitation.invited_by_name} invites you · {invitation.is_admin ? "as an administrator" : "as a user"} · waits until {day(invitation.expires_at)}
          {problem ? <div className="hintl bad" style={{ margin: "4px 0 0" }}>{problem}</div> : null}
        </div>
      </div>
      <div className="ia">
        <button type="button" className="btn2 pri" disabled={busy} onClick={() => void accept()}><Icon.check />Accept</button>
        <button type="button" className="btn2" disabled={busy} onClick={() => void decline()}>Decline</button>
      </div>
    </div>
  );
}
