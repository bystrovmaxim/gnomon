// packages/maxitor/maxitor-core/web/app/w/[code]/settings/plugins/page.tsx
// Settings → Plugins (specs/073-plugin-marketplace/mockup 1.1–7.2): only an organization's administrator sees it;
// for anyone else the address answers "No such page", the same as an address that does not exist.
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { OrgFrame, type TreePlugin } from "@/components/OrgFrame";
import { PluginsPage } from "@/components/PluginsPage";
import type { Listing } from "@/app/plugins";
import { core, me } from "@/lib/core";

type Opened = { code: string; name: string; user: { name: string; is_admin: boolean }; plugins: TreePlugin[] };

export default async function PluginsSettingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const account = await me();
  if (!account) redirect(`/?next=${encodeURIComponent(`/w/${code}/settings/plugins`)}`);
  const opened = await core<Opened>("GET", `/api/v1/organizations/${encodeURIComponent(code)}`);
  const listing = opened.ok && opened.data.user.is_admin ? await core<Listing>("GET", `/api/v1/organizations/${encodeURIComponent(code)}/plugins?query=`) : null;
  if (!opened.ok || !listing?.ok) {
    const home = opened.ok ? { code: opened.data.code, name: opened.data.name } : account.organizations[0];
    return (
      <div className="frame">
        <Header account={account} current={opened.ok ? { code: opened.data.code, name: opened.data.name } : null} methods={null} />
        <div className="nf">
          <div className="box">
            <div className="big">404</div>
            <h2>No such page</h2>
            <p>Maxitor has no page at <b>/w/{code}/settings/plugins</b> for you.</p>
            {home ? <a className="btn2 pri" href={`/w/${home.code}`}>Back to {home.name}</a> : <a className="btn2 pri" href="/new">Register an organization</a>}
          </div>
        </div>
      </div>
    );
  }
  const org = opened.data;
  return (
    <OrgFrame account={account} current={{ code: org.code, name: org.name }} isAdmin plugins={org.plugins} settings>
      <PluginsPage code={org.code} orgName={org.name} initial={listing.data} />
    </OrgFrame>
  );
}
