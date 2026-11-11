// packages/maxitor/maxitor-core/web/components/frame/Tree.tsx
// The left tree (spec 077, FR-012 – FR-017): the ordinary nodes as the core's tree action gives them, and the
// instances of every list node loaded when its parent opens, from its owner's source through the gateway, at the
// panel's moment, in parts of 50. A source that fails breaks its own branch only.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/marks";
import { windowAddress } from "@/lib/address";
import { childrenOf, lineOf, pathOf, type Instance, type TreeNode } from "@/lib/tree";

/** How many instances one part of a list holds. */
export const PART = 50;

type Scope = Record<string, string>;

type Part = { state: "loading" } | { state: "failed" } | { state: "ready"; entries: Instance[]; next: string | null; more: boolean };

/** The key of one place in the tree: a node and the scope of the instances above it. */
function placeOf(node: TreeNode, scope: Scope): string {
  return `${node.name}#${node.scope.map((name) => `${name}=${scope[name] ?? ""}`).join("&")}`;
}

function NodeIcon({ name }: { name: string }) {
  if (name === "settings") return <Icon.gear />;
  if (name === "plugins" || name === "puzzle") return <Icon.puzzle />;
  return <Icon.page />;
}

export function Tree({
  code,
  nodes,
  owners,
  at,
  selected,
  onChosen,
  onTitles,
}: {
  code: string;
  nodes: TreeNode[];
  /** The plugins in dependency order: the order of ties among children. */
  owners: string[];
  /** The panel's moment; null reads now. */
  at: string | null;
  /** The open node and the scope its address fills. */
  selected: { node: TreeNode; scope: Scope } | null;
  /** A node was chosen: on a phone the drawer closes. */
  onChosen: () => void;
  /** The titles of a list's instances as they load, by "<node>=<key>": the top row's path names them. */
  onTitles: (titles: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [parts, setParts] = useState<Record<string, Part>>({});

  // Everything on the way to the open node opens with it, list instances included.
  useEffect(() => {
    if (!selected) return;
    const line = lineOf(nodes, selected.node);
    setOpen((was) => {
      const next = new Set(was);
      // The open node opens too, so what stands under it shows.
      for (const node of line) {
        next.add(placeOf(node, selected.scope));
        if (node.each && node !== selected.node) next.add(`${placeOf(node, selected.scope)}@${selected.scope[node.each.key] ?? ""}`);
      }
      return next;
    });
  }, [nodes, selected]);

  // A moment changed: every list is read again at it.
  useEffect(() => setParts({}), [at]);

  const load = useCallback(
    async (node: TreeNode, scope: Scope, after: string | null) => {
      if (!node.each) return;
      const place = placeOf(node, scope);
      setParts((was) => (after ? was : { ...was, [place]: { state: "loading" } }));
      const query = new URLSearchParams();
      for (const name of node.scope) query.set(name, scope[name] ?? "");
      if (at) query.set("at", at);
      query.set("limit", String(PART));
      if (after) query.set("after", after);
      try {
        const answer = await fetch(`/p/${encodeURIComponent(node.owner)}/api/${encodeURIComponent(code)}/lists/${encodeURIComponent(node.each.source)}?${query}`, {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!answer.ok) throw new Error(String(answer.status));
        const data = (await answer.json()) as { entries: Instance[]; next: string | null };
        onTitles(Object.fromEntries(data.entries.map((entry) => [`${node.name}=${entry.key}`, entry.title || entry.key])));
        setParts((was) => {
          const before = after && was[place]?.state === "ready" ? (was[place] as { entries: Instance[] }).entries : [];
          return { ...was, [place]: { state: "ready", entries: [...before, ...data.entries], next: data.next, more: data.next !== null } };
        });
      } catch {
        setParts((was) => ({ ...was, [place]: { state: "failed" } }));
      }
    },
    [at, code, onTitles],
  );

  const toggle = (place: string) =>
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(place)) next.delete(place);
      else next.add(place);
      return next;
    });

  const isSelected = (node: TreeNode, scope: Scope) =>
    selected !== null && selected.node.name === node.name && node.scope.every((name) => selected.scope[name] === scope[name]) && (!node.each || selected.scope[node.each.key] === scope[node.each.key]);

  const visible = useMemo(() => {
    // A parent with no visible children and no page is hidden; a list node counts as visible until it answers.
    const shown = new Map<string, boolean>();
    const decide = (node: TreeNode): boolean => {
      const known = shown.get(node.name);
      if (known !== undefined) return known;
      const kids = nodes.filter((n) => n.parent === node.name);
      const result = node.page !== null || node.each !== null || kids.some(decide);
      shown.set(node.name, result);
      return result;
    };
    return decide;
  }, [nodes]);

  function row(node: TreeNode, scope: Scope, title: string, depth: number, place: string, hasChildren: boolean, top: boolean) {
    const path = pathOf(node, scope);
    const shut = !open.has(place);
    const fold = hasChildren ? (
      <span className={`mx-node-fold${shut ? " shut" : ""}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(place); }}>
        <Icon.chevron />
      </span>
    ) : (
      <span className="mx-node-fold" />
    );
    const inner = (
      <>
        {fold}
        <span className="mx-node-icon"><NodeIcon name={node.icon} /></span>
        <span className="mx-node-title">{title || "—"}</span>
      </>
    );
    const className = `mx-node${top ? " top" : ""}${isSelected(node, scope) ? " on" : ""}`;
    const indent = { paddingLeft: `calc(${depth} * var(--mx-space-6))` };
    if (path !== null) {
      return (
        <Link
          className={className}
          style={indent}
          href={windowAddress(code, node.owner, path, {}, at)}
          aria-current={isSelected(node, scope) ? "page" : undefined}
          onClick={() => {
            if (hasChildren) setOpen((was) => new Set(was).add(place));
            onChosen();
          }}
        >
          {inner}
        </Link>
      );
    }
    return (
      <button type="button" className={className} style={indent} aria-expanded={!shut} onClick={() => toggle(place)}>
        {inner}
      </button>
    );
  }

  function branch(parent: string, scope: Scope, depth: number): React.ReactNode[] {
    return childrenOf(nodes, parent, owners)
      .filter(visible)
      .map((node) => (node.each ? list(node, scope, depth) : ordinary(node, scope, depth)));
  }

  function ordinary(node: TreeNode, scope: Scope, depth: number) {
    const place = placeOf(node, scope);
    const kids = nodes.some((n) => n.parent === node.name);
    return (
      <div key={place} role="treeitem" aria-expanded={kids ? open.has(place) : undefined}>
        {row(node, scope, node.title, depth, place, kids, depth === 0)}
        {kids && open.has(place) ? <div role="group">{branch(node.name, scope, depth + 1)}</div> : null}
      </div>
    );
  }

  function list(node: TreeNode, scope: Scope, depth: number) {
    const place = placeOf(node, scope);
    return <ListBranch key={place} node={node} scope={scope} depth={depth} place={place} />;
  }

  function ListBranch({ node, scope, depth, place }: { node: TreeNode; scope: Scope; depth: number; place: string }) {
    const part = parts[place];
    useEffect(() => {
      if (!part) void load(node, scope, null);
    }, [part, place]);
    if (!part || part.state === "loading") return <div className="mx-node-note" style={{ paddingLeft: `calc(${depth} * var(--mx-space-6))` }}>Loading…</div>;
    if (part.state === "failed") {
      return (
        <div className="mx-node-note bad" role="alert" style={{ paddingLeft: `calc(${depth} * var(--mx-space-6))` }}>
          This list could not be read.
          <button type="button" onClick={() => void load(node, scope, null)}>Try again</button>
        </div>
      );
    }
    const kids = nodes.some((n) => n.parent === node.name);
    return (
      <>
        {part.entries.map((entry) => {
          const inner = { ...scope, [node.each!.key]: entry.key };
          const instancePlace = `${place}@${entry.key}`;
          return (
            <div key={instancePlace} role="treeitem" aria-expanded={kids ? open.has(instancePlace) : undefined}>
              {row(node, inner, entry.title || entry.key, depth, instancePlace, kids, false)}
              {kids && open.has(instancePlace) ? <div role="group">{branch(node.name, inner, depth + 1)}</div> : null}
            </div>
          );
        })}
        {part.entries.length === 0 ? <div className="mx-node-note" style={{ paddingLeft: `calc(${depth} * var(--mx-space-6))` }}>Nothing here yet.</div> : null}
        {part.more ? (
          <button type="button" className="mx-node" style={{ paddingLeft: `calc(${depth} * var(--mx-space-6))` }} onClick={() => void load(node, scope, part.next)}>
            <span className="mx-node-fold" />
            <span className="mx-node-title">More…</span>
          </button>
        ) : null}
      </>
    );
  }

  const roots = childrenOf(nodes, "root", owners).filter(visible);
  const body = roots.filter((node) => node.owner !== "core");
  const foot = roots.filter((node) => node.owner === "core");

  return (
    <>
      <div className="mx-tree-scroll" role="tree" aria-label="The organization's tree">
        {body.length === 0 ? <div className="mx-tree-empty">Nothing here yet.<br />Plugins add their sections to this tree.</div> : null}
        {body.map((node) => (node.each ? list(node, {}, 0) : ordinary(node, {}, 0)))}
      </div>
      {foot.length ? <div className="mx-tree-foot" role="tree" aria-label="Settings">{foot.map((node) => ordinary(node, {}, 0))}</div> : null}
    </>
  );
}
