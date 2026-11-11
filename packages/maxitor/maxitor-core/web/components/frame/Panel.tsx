// packages/maxitor/maxitor-core/web/components/frame/Panel.tsx
// The right panel (spec 077, FR-021 – FR-023): the grey field with dots; the core's own pages drawn on it, a plugin's
// page in a transparent frame over it at /p/<name>/<organization>/<path>.
"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Controls } from "@/components/frame/Controls";
import { PageFrame } from "@/components/frame/PageFrame";
import type { PanelAddress } from "@/lib/address";
import type { TreeNode } from "@/lib/tree";

/** "No such page": an address of a node that is not in the person's tree. */
export function NoSuchPage({ code }: { code: string }) {
  return (
    <div className="mx-panel-note" role="status">
      <div className="mx-big">404</div>
      <b>No such page</b>
      Maxitor has no page at this address for you in this organization.
      <br />
      <Link href={`/w/${code}`}>Back to the organization</Link>
    </div>
  );
}

export function Panel({
  code,
  address,
  opened,
  dependencies,
  onTitle,
  children,
}: {
  code: string;
  address: PanelAddress | null;
  opened: { node: TreeNode; scope: Record<string, string> } | null;
  /** Each enabled plugin's direct dependencies: the owners a page of it may open. */
  dependencies: Record<string, string[]>;
  onTitle: (title: string | null) => void;
  children: ReactNode;
}) {
  const owner = address?.owner ?? null;
  // The organization's root and the core's own pages are drawn by the core itself.
  if (owner === null || owner === "core") {
    return (
      <main className="mx-panel">
        <div className="mx-panel-own">{children}</div>
      </main>
    );
  }
  if (!opened || !address) {
    return (
      <main className="mx-panel">
        <NoSuchPage code={code} />
      </main>
    );
  }
  const allowed = new Set(["core", ...(dependencies[owner] ?? [])]);
  return (
    <main className="mx-panel">
      {/* Another owner is another frame: the key gives it a new frame and a new address. */}
      <PageFrame
        key={owner}
        code={code}
        address={address}
        owner={owner}
        base={`/p/${encodeURIComponent(owner)}/${encodeURIComponent(code)}`}
        title={opened.node.title || opened.node.name}
        canOpen={(other) => allowed.has(other)}
        onTitle={onTitle}
      />
      {opened.node.controls ? <Controls code={code} owner={owner} controls={opened.node.controls} address={address} scope={opened.scope} /> : null}
    </main>
  );
}
