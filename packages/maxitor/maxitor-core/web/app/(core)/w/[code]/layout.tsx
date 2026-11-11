// packages/maxitor/maxitor-core/web/app/w/[code]/layout.tsx
// The frame of an organization (spec 077): the person, the organization and its tree are read once here and stay
// while the panel's address changes. "No such organization" alike for a stranger and a made-up address.
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Frame } from "@/components/frame/Frame";
import { Icon } from "@/components/marks";
import { core, me } from "@/lib/core";
import type { TreeNode } from "@/lib/tree";

type Opened = { code: string; name: string; user: { name: string; is_admin: boolean }; tree: TreeNode[]; owners: string[]; dependencies: Record<string, string[]> };

export default async function OrganizationLayout({ children, params }: { children: ReactNode; params: Promise<{ code: string }> }) {
  const { code } = await params;
  const account = await me();
  if (!account) redirect(`/?next=${encodeURIComponent(`/w/${code}`)}`);
  const answer = await core<Opened>("GET", `/api/v1/organizations/${encodeURIComponent(code)}`);
  if (!answer.ok) {
    const home = account.organizations[0];
    return (
      <div className="frame">
        <div className="nf">
          <div className="box">
            <div className="big">404</div>
            <h2>No such organization</h2>
            <p>Maxitor has no organization at <b>/w/{code}</b> that you work in.<br />It may not exist, or you are not one of its users.</p>
            {home ? <a className="btn2 pri" href={`/w/${home.code}`}>Go to {home.name}</a> : <a className="btn2 pri" href="/new">Register an organization <Icon.plus /></a>}
          </div>
        </div>
      </div>
    );
  }
  const org = answer.data;
  return (
    <Frame account={account} current={{ code: org.code, name: org.name }} nodes={org.tree} owners={org.owners} dependencies={org.dependencies}>
      {children}
    </Frame>
  );
}
