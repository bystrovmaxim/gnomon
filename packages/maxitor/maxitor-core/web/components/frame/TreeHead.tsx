// packages/maxitor/maxitor-core/web/components/frame/TreeHead.tsx
// The head of the tree (specs 078, 085 and 079): collapse and Back, standing on the level's left edge. Collapse folds
// the tree to a strip holding the expand button alone, and is not kept between visits; on a phone it leaves the tree a
// drawer. Back steps out of the deepest section entered through the address — the tree, the crumbs, the address and the
// page then show the same place — and is not drawn at the root, where there is no level above.
"use client";

import { TreeMark } from "@/components/frame/treeMarks";

export function TreeHead({ collapsed, onCollapse, onBack }: { collapsed: boolean | null; onCollapse: () => void; onBack: (() => void) | null }) {
  return (
    <div className="mx-tree-head">
      {collapsed === null ? null : (
        <button type="button" className="mx-tree-button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={onCollapse}>
          <TreeMark.sidebar />
        </button>
      )}
      {onBack && !collapsed ? (
        <button type="button" className="mx-tree-button" aria-label="Back" title="Back" onClick={onBack}>
          <TreeMark.back />
        </button>
      ) : null}
    </div>
  );
}
