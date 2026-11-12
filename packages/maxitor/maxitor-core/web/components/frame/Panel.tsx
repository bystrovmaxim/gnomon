// packages/maxitor/maxitor-core/web/components/frame/Panel.tsx
// The right panel (spec 077, FR-021 – FR-023): the grey field with dots; the core's own pages drawn on it, a plugin's
// page in a transparent frame over it at /p/<name>/<organization>/<path>.
"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type { HistoryAllowed } from "@maxitor/panel/protocol";

import { PageFrame } from "@/components/frame/PageFrame";
import { useScale } from "@/components/scale/bridge";
import { windowAddress, type PanelAddress } from "@/lib/address";
import { laterThan, MOMENT_TEXT } from "@/lib/moment";
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

/** Whether the address's moment can be read: a moment, and not later than the organization's watermark. */
function momentProblem(at: string | null, watermark: string | null): "not_a_moment" | "after_now" | null {
  if (!at) return null;
  if (!MOMENT_TEXT.test(at)) return "not_a_moment";
  return watermark && laterThan(at, watermark) ? "after_now" : null;
}

/** The address names a moment that cannot be read: say so and offer now. */
function MomentProblem({ code, address, problem }: { code: string; address: PanelAddress; problem: "not_a_moment" | "after_now" }) {
  const now = address.owner ? windowAddress(code, address.owner, address.path, address.query, null) : `/w/${code}`;
  return (
    <div className="mx-panel-note" role="alert">
      <b>{problem === "not_a_moment" ? "This address names no moment" : "This moment has not come yet"}</b>
      {problem === "not_a_moment" ? `“${address.at}” is not a moment Maxitor can read.` : "Maxitor reads up to now, never later."}
      <br />
      <Link href={now}>Show now</Link>
    </div>
  );
}

export function Panel({
  code,
  address,
  opened,
  dependencies,
  histories,
  onTitle,
  children,
}: {
  code: string;
  address: PanelAddress | null;
  opened: { node: TreeNode; scope: Record<string, string> } | null;
  /** Each enabled plugin's direct dependencies: the owners a page of it may open. */
  dependencies: Record<string, string[]>;
  /** Each enabled plugin's history actions and comparisons. */
  histories: Record<string, HistoryAllowed>;
  onTitle: (title: string | null) => void;
  children: ReactNode;
}) {
  const owner = address?.owner ?? null;
  const problem = momentProblem(address?.at ?? null, useScale().watermark);
  if (address && problem) {
    return (
      <main className="mx-panel">
        <MomentProblem code={code} address={address} problem={problem} />
      </main>
    );
  }
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
        pathNames={Object.keys(opened.scope)}
        historyAllowed={histories[owner] ?? { actions: [], compare: [] }}
        onTitle={onTitle}
      />
    </main>
  );
}
