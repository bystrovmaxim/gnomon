// packages/maxitor/maxitor-core/web/app/w/[code]/layout.tsx
// The frame of an organization (spec 077): the person, the organization and its tree are read once here and stay
// while the panel's address changes. "No such organization" alike for a stranger and a made-up address.
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Frame } from "@/components/frame/Frame";
import { Icon } from "@/components/marks";
import { core, me } from "@/lib/core";
import type { TreeNode } from "@/lib/tree";

type Opened = { code: string; name: string; user: { name: string; is_admin: boolean }; plugins: { name: string; title: string; sections: { title: string; path: string }[] }[] };

/** The tree of an organization: the core's Settings for an administrator and each enabled plugin's sections. */
function treeOf(org: Opened): { nodes: TreeNode[]; owners: string[] } {
  const nodes: TreeNode[] = [];
  const blank: Pick<TreeNode, "each" | "scope" | "controls"> = { each: null, scope: [], controls: null };
  org.plugins.forEach((plugin, index) => {
    plugin.sections.forEach((section, position) =>
      nodes.push({ ...blank, name: `${plugin.name}:${position}`, owner: plugin.name, parent: "root", order: index * 100 + position, title: section.title, icon: "page", page: section.path }),
    );
  });
  if (org.user.is_admin) {
    nodes.push({ ...blank, name: "core:settings", owner: "core", parent: "root", order: 10000, title: "Settings", icon: "settings", page: null });
    nodes.push({ ...blank, name: "core:settings.plugins", owner: "core", parent: "core:settings", order: 100, title: "Plugins", icon: "puzzle", page: "/settings/plugins" });
  }
  return { nodes, owners: org.plugins.map((p) => p.name) };
}

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
  const { nodes, owners } = treeOf(org);
  return (
    <Frame account={account} current={{ code: org.code, name: org.name }} nodes={nodes} owners={owners}>
      {children}
    </Frame>
  );
}
