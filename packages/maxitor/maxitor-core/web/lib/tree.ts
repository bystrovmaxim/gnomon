// packages/maxitor/maxitor-core/web/lib/tree.ts
// The organization's tree as the core's action gives it (specs/077-core-frame/data-model.md): every node with its
// full name, owner, parent and the scope of parameters at its place. The frame draws it; it never decides it.
import { fillPage, matchPage } from "@/lib/address";
import { enteredInLine, lineOf } from "@/lib/levels";

export { lineOf };

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
  /** How it opens (spec 085): expand under itself in this tree, or enter into a panel of its children. */
  opens: "expand" | "enter";
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

/** The page path of a node in a scope, or null when the scope lacks a parameter. */
export function pathOf(node: TreeNode, scope: Record<string, string>): string | null {
  return node.page === null ? null : fillPage(node.page, scope);
}

/**
 * The entered levels above a node, the deepest last (spec 085, FR-013): every entered node on its line, the node
 * itself included when it is entered. An address gives the panel exactly this, so a reload lands where the person was.
 */
export function enteredLine(nodes: TreeNode[], node: TreeNode): TreeNode[] {
  return enteredInLine(nodes, node);
}
