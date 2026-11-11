// packages/maxitor/maxitor-core/web/lib/tree.ts
// The organization's tree as the core's action gives it (specs/077-core-frame/data-model.md): every node with its
// full name, owner, parent and the scope of parameters at its place. The frame draws it; it never decides it.
import { fillPage, matchPage } from "@/lib/address";

export type Choice = { value: string; label: string; icon?: string };

export type Controls = {
  mode?: { param: string; default: string; options: Choice[]; counts?: string };
  views?: { param: string; default: string; options: Choice[] };
  filters?: { title: string; param: string; options?: { value: string; label: string; colour?: string }[]; source?: string }[];
  legend?: { title: string; rows?: { label: string; colour: string }[]; source?: string };
};

export type TreeNode = {
  name: string;
  owner: string;
  parent: string;
  order: number;
  title: string;
  icon: string;
  page: string | null;
  each: { source: string; key: string } | null;
  scope: string[];
  controls: Controls | null;
};

/** One instance of a list node, from its owner's source at the panel's moment. */
export type Instance = { key: string; title: string; icon: string };

/** The children of a parent, in the order the plugin concept fixes: by order, the core first, then by name. */
export function childrenOf(nodes: TreeNode[], parent: string, owners: string[]): TreeNode[] {
  const rank = (owner: string) => (owner === "core" ? -1 : owners.indexOf(owner));
  return nodes
    .filter((node) => node.parent === parent)
    .sort((a, b) => a.order - b.order || rank(a.owner) - rank(b.owner) || a.name.localeCompare(b.name));
}

/** The node an address opens and the scope its path fills, found by matching the owner's page templates. */
export function nodeOf(nodes: TreeNode[], owner: string, path: string): { node: TreeNode; scope: Record<string, string> } | null {
  for (const node of nodes) {
    if (node.owner !== owner || node.page === null) continue;
    const scope = matchPage(node.page, path);
    if (scope) return { node, scope };
  }
  return null;
}

/** The path from the root to a node, the node last. */
export function lineOf(nodes: TreeNode[], node: TreeNode): TreeNode[] {
  const byName = new Map(nodes.map((n) => [n.name, n]));
  const line: TreeNode[] = [node];
  let parent = byName.get(node.parent);
  while (parent) {
    line.unshift(parent);
    parent = byName.get(parent.parent);
  }
  return line;
}

/** The page path of a node in a scope, or null when the scope lacks a parameter. */
export function pathOf(node: TreeNode, scope: Record<string, string>): string | null {
  return node.page === null ? null : fillPage(node.page, scope);
}
