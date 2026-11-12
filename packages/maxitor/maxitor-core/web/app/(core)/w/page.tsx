// packages/maxitor/maxitor-core/web/app/w/page.tsx
// After signing in (mockup 3, 8.10, 8.12, 8.14): the invitations waiting for the account first, with Accept and
// Decline; then no organization → register one; one → straight there; several → choose.
import { redirect } from "next/navigation";

import { listInvitations } from "@/app/actions";
import { Icon } from "@/components/marks";
import { InvitationChoice } from "@/components/InvitationChoice";
import { colorOf } from "@/lib/colors";
import { me } from "@/lib/core";

export default async function ChoosePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const account = await me();
  if (!account) redirect("/?next=/w");
  const orgs = account.organizations;
  const invitations = account.invitations_waiting > 0 ? await listInvitations() : [];
  const declined = query.declined ?? null;
  if (invitations.length === 0 && !declined) {
    if (orgs.length === 0) redirect("/new");
    if (orgs.length === 1) redirect(`/w/${orgs[0].code}`);
  }
  const title = orgs.length === 0 ? (invitations.length ? "You are invited" : "No organization yet") : "Choose an organization";
  const sub =
    orgs.length === 0
      ? invitations.length
        ? `${account.email} · an invitation is for the email it was sent to, so only you see it here.`
        : `${account.email} works in no organization.`
      : `${account.email} works in ${orgs.length} ${orgs.length === 1 ? "organization" : "organizations"}${invitations.length ? ` and is invited to ${invitations.length === 1 ? "one more" : `${invitations.length} more`}` : ""}.`;
  return (
    <div className="pick">
      <div className="inner">
        <h2>{title}</h2>
        <div className="sub">{sub}</div>
        {declined ? (
          <div className="alert ok" role="status">
            <Icon.check />
            <div><b>You declined the invitation to {declined}.</b> Its administrators can send a new one.</div>
          </div>
        ) : null}
        {invitations.length ? (
          <>
            {orgs.length ? <div className="dsec">Invitations</div> : null}
            {invitations.map((invitation) => (
              <InvitationChoice key={invitation.id} invitation={invitation} />
            ))}
          </>
        ) : null}
        {orgs.length ? (
          <>
            {invitations.length ? <div className="dsec">Your organizations</div> : null}
            {orgs.map((o) => (
              <a key={o.code} className="orow" href={`/w/${o.code}`}>
                <span className="oa" style={{ background: colorOf(o.code) }}>{o.name[0]}</span>
                <div className="on"><b>{o.name}</b><div>/w/{o.code}</div></div>
                {o.is_admin ? <span className="badge adm">administrator</span> : null}
              </a>
            ))}
          </>
        ) : null}
        {invitations.length && !orgs.length ? <div className="dsec">Or</div> : null}
        <a className="orow add" href="/new">
          <span className="oa"><Icon.plus /></span>
          <div className="on">{orgs.length ? "Register another organization" : "Register your own organization"}</div>
        </a>
      </div>
    </div>
  );
}
