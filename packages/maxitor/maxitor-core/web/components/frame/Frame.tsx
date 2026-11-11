// packages/maxitor/maxitor-core/web/components/frame/Frame.tsx
// The frame every plugin lives in (spec 077, the plugin concept 7): the top row, the tree on the left and the right
// panel. It stays mounted while the address changes, so the tree keeps its open nodes and its scroll; what the panel
// shows comes from the address alone.
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import "./frame.css";
import { Panel } from "@/components/frame/Panel";
import { TopRow } from "@/components/frame/TopRow";
import { Tree } from "@/components/frame/Tree";
import { readAddress, windowAddress } from "@/lib/address";
import type { Me } from "@/lib/core";
import { lineOf, nodeOf, type TreeNode } from "@/lib/tree";

export function Frame({
  account,
  current,
  nodes,
  owners,
  dependencies,
  children,
}: {
  account: Me;
  current: { code: string; name: string };
  nodes: TreeNode[];
  /** The organization's enabled plugins in dependency order. */
  owners: string[];
  /** Each enabled plugin's direct dependencies. */
  dependencies: Record<string, string[]>;
  /** The core's own page for the address, drawn in the panel; nothing for a plugin's page. */
  children: ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  // After linking a way in, the address asks to open the sign-in methods dialog with its notice.
  const methods = search.get("methods");

  const address = useMemo(() => readAddress(pathname, search), [pathname, search]);
  const opened = useMemo(() => (address?.owner ? nodeOf(nodes, address.owner, address.path) : null), [address, nodes]);
  // A page's title belongs to the page it came from.
  useEffect(() => setTitle(null), [opened?.node.name]);

  // The path in the top row: the titles of the nodes on the way, an instance's from the page when it sends one.
  const path = useMemo(() => {
    if (!opened) return [];
    const line = lineOf(nodes, opened.node);
    const titles = line.map((node) => node.title || (node.each ? opened.scope[node.each.key] ?? "" : ""));
    if (title) titles[titles.length - 1] = title;
    return titles;
  }, [nodes, opened, title]);

  // Another organization opens the same page, or its root when the page is not there: the tree decides there.
  const switchTo = (code: string) => (address?.owner ? windowAddress(code, address.owner, address.path, address.query, address.at) : `/w/${code}`);

  const tree = (
    <Tree code={current.code} nodes={nodes} owners={owners} at={address?.at ?? null} selected={opened} onChosen={() => setDrawer(false)} />
  );

  return (
    <div className="mx-frame">
      <TopRow account={account} current={current} path={path} methods={methods} switchTo={switchTo} onMenu={() => setDrawer(true)} />
      <div className="mx-body">
        <aside className="mx-tree">{tree}</aside>
        <Panel code={current.code} address={address} opened={opened} dependencies={dependencies} onTitle={setTitle}>
          {children}
        </Panel>
        {drawer ? (
          <>
            <div className="mx-scrim" onClick={() => setDrawer(false)} />
            <aside className="mx-tree drawer">{tree}</aside>
          </>
        ) : null}
      </div>
    </div>
  );
}
