// packages/maxitor/maxitor-core/web/components/frame/Tree.tsx
// The left tree (specs 077 and 085): one level at a time — the children of the node entered at the head of the panel,
// or the root's — and every node opens the way its author wrote in navigation.yaml: it expands under itself, or it is
// entered. A node that is entered shows "›" and reads none of its children before the click. The instances of a list
// node load when it opens, from its owner's source through the gateway, at the panel's moment, in parts of 50; a
// source that fails breaks its own branch only.
"use client";

import { TreeMark } from "@/components/frame/treeMarks";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { windowAddress } from "@/lib/address";
import { childrenOf, lineOf, pathOf, type Instance, type TreeNode } from "@/lib/tree";

/** How many instances one part of a list holds. */
export const PART = 50;

type Scope = Record<string, string>;

/** A level of the panel: the node entered at its head, or the root when there is none, with the scope of its children. */
export type Level = { node: TreeNode; scope: Scope; title: string };

type Part = { state: "loading" } | { state: "failed" } | { state: "ready"; entries: Instance[]; next: string | null; more: boolean };

/** The key of one place in the tree: a node and the scope of the instances above it. */
function placeOf(node: TreeNode, scope: Scope): string {
  return `${node.name}#${node.scope.map((name) => `${name}=${scope[name] ?? ""}`).join("&")}`;
}

function NodeIcon({ name }: { name: string }) {
  if (name === "settings") return <TreeMark.settings />;
  if (name === "plugins" || name === "puzzle") return <TreeMark.plugins />;
  return <TreeMark.page />;
}

export function Tree({
  code,
  nodes,
  owners,
  at,
  level,
  selected,
  onEnter,
  onChosen,
  onTitles,
}: {
  code: string;
  nodes: TreeNode[];
  /** The plugins in dependency order: the order of ties among children. */
  owners: string[];
  /** The panel's moment; null reads now. */
  at: string | null;
  /** The level at the head of the panel; null shows the root of the tree. */
  level: Level | null;
  /** The open node and the scope its address fills. */
  selected: { node: TreeNode; scope: Scope } | null;
  /** A node that is entered was clicked: the panel comes to hold its children only. */
  onEnter: (node: TreeNode, scope: Scope, title: string) => void;
  /** A node was chosen: on a phone the drawer closes. */
  onChosen: () => void;
  /** The titles of a list's instances as they load, by "<node>=<key>": the top row's path names them. */
  onTitles: (titles: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [parts, setParts] = useState<Record<string, Part>>({});

  // Everything on the way to the open node opens with it, list instances included — but nothing above the level, and
  // nothing that is entered: those are levels of their own, never rows of this one (spec 085).
  useEffect(() => {
    if (!selected) return;
    const line = lineOf(nodes, selected.node);
    const from = level === null ? -1 : line.findIndex((node) => node.name === level.node.name);
    const below = from < 0 ? line : line.slice(from + 1);
    setOpen((was) => {
      const next = new Set(was);
      for (const node of below) {
        if (node.opens === "enter") break;
        next.add(placeOf(node, selected.scope));
        if (node.each) next.add(`${placeOf(node, selected.scope)}@${selected.scope[node.each.key] ?? ""}`);
      }
      return next;
    });
  }, [nodes, selected, level]);

  // A moment changed, or the panel entered or left a section — Back included —: every list is read again, so what
  // changed meanwhile, or failed to be read before, shows without reloading the page.
  const levelKey = level === null ? "" : `${level.node.name}|${JSON.stringify(level.scope)}`;
  useEffect(() => setParts({}), [at, levelKey]);

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
    // A node that is entered shows "›" instead of the arrow: a click makes a level of it, never a branch of this one.
    const entered = node.opens === "enter";
    const shut = !open.has(place);
    const fold = entered ? (
      <span className="mx-node-fold" />
    ) : hasChildren ? (
      <span className={`mx-node-fold${shut ? " shut" : ""}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(place); }}>
        <TreeMark.fold />
      </span>
    ) : (
      <span className="mx-node-fold" />
    );
    const mark = entered ? <span className="mx-node-enter" aria-hidden="true">›</span> : null;
    const inner = (
      <>
        {fold}
        <span className="mx-node-icon"><NodeIcon name={node.icon} /></span>
        <span className="mx-node-title">{title || "—"}</span>
        {mark}
      </>
    );
    const className = `mx-node${top ? " top" : ""}${isSelected(node, scope) ? " on" : ""}`;
    const indent = { paddingLeft: `calc(${depth} * var(--mx-space-6))` };
    const chosen = () => {
      if (entered) onEnter(node, scope, title);
      else if (hasChildren) setOpen((was) => new Set(was).add(place));
      // A page opens and the drawer closes with it; a level entered on a phone keeps the drawer, its head and its rows.
      if (path !== null) onChosen();
    };
    if (path !== null) {
      return (
        <Link className={className} style={indent} href={windowAddress(code, node.owner, path, {}, at)} aria-current={isSelected(node, scope) ? "page" : undefined} onClick={chosen}>
          {inner}
        </Link>
      );
    }
    return (
      <button type="button" className={className} style={indent} aria-expanded={entered ? undefined : !shut} onClick={chosen}>
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
    const entered = node.opens === "enter";
    return (
      <div key={place} role="treeitem" aria-expanded={entered || !kids ? undefined : open.has(place)}>
        {row(node, scope, node.title, depth, place, kids, depth === 0)}
        {!entered && kids && open.has(place) ? <div role="group">{branch(node.name, scope, depth + 1)}</div> : null}
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
    const entered = node.opens === "enter";
    return (
      <>
        {part.entries.map((entry) => {
          const inner = { ...scope, [node.each!.key]: entry.key };
          const instancePlace = `${place}@${entry.key}`;
          const label = entry.title || entry.key;
          return (
            <div key={instancePlace} role="treeitem" aria-expanded={entered || !kids ? undefined : open.has(instancePlace)}>
              {row(node, inner, label, depth, instancePlace, kids, false)}
              {!entered && kids && open.has(instancePlace) ? <div role="group">{branch(node.name, inner, depth + 1)}</div> : null}
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

  // The level's children, in the order the plugin concept fixes; at the root the core's own nodes stand at the foot.
  const scope = level ? level.scope : {};
  const roots = childrenOf(nodes, level ? level.node.name : "root", owners).filter(visible);
  const body = level ? roots : roots.filter((node) => node.owner !== "core");
  const foot = level ? [] : roots.filter((node) => node.owner === "core");

  return (
    <>
      {level ? (
        <div className="mx-level-head">
          <span className="mx-level-icon"><NodeIcon name={level.node.icon} /></span>
          <span className="mx-level-title">{level.title}</span>
        </div>
      ) : null}
      <div className="mx-tree-scroll" role="tree" aria-label={level ? level.title : "The organization's tree"}>
        {body.length === 0 ? <div className="mx-tree-empty">Nothing here yet.<br />{level ? "This node holds nothing yet." : "Plugins add their sections to this tree."}</div> : null}
        {body.map((node) => (node.each ? list(node, scope, 0) : ordinary(node, scope, 0)))}
      </div>
      {foot.length ? <div className="mx-tree-foot" role="tree" aria-label="Settings">{foot.map((node) => ordinary(node, scope, 0))}</div> : null}
    </>
  );
}
