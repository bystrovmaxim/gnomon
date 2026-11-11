// packages/maxitor/maxitor-core/web/components/frame/TreeHead.tsx
// The head of the tree (spec 078, FR-018): collapse, which folds the tree to its head and is not kept between visits,
// and up, which opens the nearest node above the open one that has a page, at the same moment and without the
// page's own parameters. Up does not repeat the browser's Back, which already steps through the panel's address.
"use client";

import Link from "next/link";

import { Icon } from "@/components/marks";

export function TreeHead({ collapsed, onCollapse, up }: { collapsed: boolean | null; onCollapse: () => void; up: string | null }) {
  return (
    <div className="mx-tree-head">
      {collapsed === null ? null : (
        <button type="button" className="mx-tree-button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={onCollapse}>
          <Icon.sidebar />
        </button>
      )}
      {up ? (
        <Link className="mx-tree-button" href={up} aria-label="Up" title="Up">
          <Icon.up />
        </Link>
      ) : (
        <span className="mx-tree-button off" role="link" aria-disabled="true" aria-label="Up" title="Up">
          <Icon.up />
        </span>
      )}
    </div>
  );
}
