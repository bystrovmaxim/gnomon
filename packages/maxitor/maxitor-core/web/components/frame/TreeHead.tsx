// packages/maxitor/maxitor-core/web/components/frame/TreeHead.tsx
// The head of the tree (specs 078 and 085): two buttons, collapse and the arrow. Collapse folds the tree to its head
// and is not kept between visits; on a phone it leaves the tree a drawer. The arrow is Back: it returns the panel to
// the level it showed before the last entering, keeping what was expanded there and opening no page, and it is off at
// the root of the tree. The up it served until bystrovmaxim/gnomon#122 — open the nearest node above with a page —
// is gone, and so is FR-018 of bystrovmaxim/gnomon#109 as it was written.
"use client";

import { Icon } from "@/components/marks";

export function TreeHead({ collapsed, onCollapse, onBack }: { collapsed: boolean | null; onCollapse: () => void; onBack: (() => void) | null }) {
  return (
    <div className="mx-tree-head">
      {collapsed === null ? null : (
        <button type="button" className="mx-tree-button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={onCollapse}>
          <Icon.sidebar />
        </button>
      )}
      {onBack ? (
        <button type="button" className="mx-tree-button" aria-label="Back" title="Back" onClick={onBack}>
          <Icon.left />
        </button>
      ) : (
        <span className="mx-tree-button off" role="link" aria-disabled="true" aria-label="Back" title="Back">
          <Icon.left />
        </span>
      )}
    </div>
  );
}
