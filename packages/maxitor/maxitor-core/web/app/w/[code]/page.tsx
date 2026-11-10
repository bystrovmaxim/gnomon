// packages/maxitor/maxitor-core/web/app/w/[code]/page.tsx
// The frame of an organization (mockups 072 4.1–4.5, 073 1.5): its tree with the enabled plugins' groups; "No such
// organization" alike for a stranger and a made-up address.
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { OrgFrame, type TreePlugin } from "@/components/OrgFrame";
import { core, me } from "@/lib/core";

type Opened = { code: string; name: string; user: { name: string; is_admin: boolean }; plugins: TreePlugin[] };

export default async function OrganizationPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { code } = await params;
  const query = await searchParams;
  const account = await me();
  if (!account) redirect(`/?next=${encodeURIComponent(`/w/${code}`)}`);
  const answer = await core<Opened>("GET", `/api/v1/organizations/${encodeURIComponent(code)}`);
  if (!answer.ok) {
    const home = account.organizations[0];
    return (
      <div className="frame">
        <Header account={account} current={null} methods={query.methods ?? null} />
        <div className="nf">
          <div className="box">
            <div className="big">404</div>
            <h2>No such organization</h2>
            <p>Maxitor has no organization at <b>/w/{code}</b> that you work in.<br />It may not exist, or you are not one of its users.</p>
            {home ? <a className="btn2 pri" href={`/w/${home.code}`}>Go to {home.name}</a> : <a className="btn2 pri" href="/new">Register an organization</a>}
          </div>
        </div>
      </div>
    );
  }
  const org = answer.data;
  return (
    <OrgFrame account={account} current={{ code: org.code, name: org.name }} isAdmin={org.user.is_admin} plugins={org.plugins} methods={query.methods ?? null}>
      <div className="content">
        <div className="dots" />
        {org.plugins.length === 0 ? (
          <div className="empty-c"><b>{org.name} is ready</b><br />The organization is empty: no plugin is enabled yet.</div>
        ) : (
          <div className="empty-c"><b>{org.name}</b><br />Choose a section in the tree.</div>
        )}
      </div>
    </OrgFrame>
  );
}
