// packages/maxitor/maxitor-core/web/app/w/page.tsx
// After signing in (mockup 3): no organization → register one; one → straight there; several → choose.
import { redirect } from "next/navigation";

import { Icon } from "@/components/marks";
import { colorOf } from "@/lib/colors";
import { me } from "@/lib/core";

export default async function ChoosePage() {
  const account = await me();
  if (!account) redirect("/?next=/w");
  const orgs = account.organizations;
  if (orgs.length === 0) redirect("/new");
  if (orgs.length === 1) redirect(`/w/${orgs[0].code}`);
  return (
    <div className="pick">
      <div className="inner">
        <h2>Choose an organization</h2>
        <div className="sub">{account.email} works in {orgs.length} organizations. You can switch later from the organization’s name at the top.</div>
        {orgs.map((o) => (
          <a key={o.code} className="orow" href={`/w/${o.code}`}>
            <span className="oa" style={{ background: colorOf(o.code) }}>{o.name[0]}</span>
            <div className="on"><b>{o.name}</b><div>/w/{o.code}</div></div>
            {o.is_admin ? <span className="badge adm">administrator</span> : null}
          </a>
        ))}
        <a className="orow add" href="/new">
          <span className="oa"><Icon.plus /></span>
          <div className="on">Register another organization</div>
        </a>
      </div>
    </div>
  );
}
