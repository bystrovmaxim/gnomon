// packages/maxitor/maxitor-web/client/scripts/generate-large-graph.ts
/**
 * generate-large-graph — a graph 30 times the stand's, for measuring the map (spec 040).
 *
 * Copies a graph file, every id prefixed by its copy, shares the application node, links each action to its namesake
 * in the next copy so that links cross domains, and writes a second version changing one domain.
 *
 *   node scripts/generate-large-graph.ts <graph.json> <output folder> [copies]
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type GraphNode = { id: string; type: string; label: string; properties: Record<string, unknown> };
type GraphEdge = { id: string; source_id: string; target_id: string; type: string; relationship: string; properties: Record<string, unknown> };
type GraphFile = { nodes: GraphNode[]; edges: GraphEdge[] };

const args = process.argv.slice(2);
const tablesArg = args.find((arg) => arg.startsWith("--tables="));
const positional = args.filter((arg) => !arg.startsWith("--"));
const [input, output, copiesText] = positional;
const copies = Number(copiesText ?? 30);
const graph = JSON.parse(readFileSync(input, "utf8")) as GraphFile;
const shared = new Set(graph.nodes.filter((node) => node.type === "Application").map((node) => node.id));
const inCopy = (copy: number, id: string) => (shared.has(id) ? id : `s${copy}.${id}`);

/** An edge's id in a copy: every id it names is prefixed, a field's name is not. */
function copiedId(edge: GraphEdge, copy: number): string {
  const parts = edge.id.split("|");
  parts[0] = inCopy(copy, parts[0]);
  if (edge.type !== "entity_relation" && parts[2]) parts[2] = inCopy(copy, parts[2]);
  return parts.join("|");
}

const dependency = graph.edges.find((edge) => edge.type === "@depends")!;
const actions = graph.nodes.filter((node) => node.type === "Action").map((node) => node.id);
const build = (count: number) => {
  const nodes = graph.nodes.filter((node) => shared.has(node.id));
  const edges: GraphEdge[] = [];
for (let copy = 0; copy < count; copy += 1) {
  for (const node of graph.nodes) {
    if (shared.has(node.id)) continue;
    nodes.push({ ...node, id: inCopy(copy, node.id), label: node.type === "Domain" ? `${node.label}${copy}` : node.label });
  }
  for (const edge of graph.edges) edges.push({ ...edge, id: copiedId(edge, copy), source_id: inCopy(copy, edge.source_id), target_id: inCopy(copy, edge.target_id) });
  for (const action of actions) {
    const source = inCopy(copy, action);
    const target = inCopy((copy + 1) % count, action);
    edges.push({ ...dependency, id: `${source}|@depends|${target}`, source_id: source, target_id: target });
  }
}
  return { nodes, edges };
};
mkdirSync(output, { recursive: true });
const tables = graph.nodes.filter((node) => node.type === "Entity").length;
const tablesArgValue = tablesArg?.split("=")[1];
if (tablesArgValue) {
  // One drawing per target, its copies chosen so the whole system's ERD holds that many tables.
  for (const target of tablesArgValue.split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0)) {
    const { nodes: nodesFor, edges: edgesFor } = build(Math.max(1, Math.ceil(target / Math.max(tables, 1))));
    writeFileSync(join(output, `tables-${target}.json`), JSON.stringify({ ...graph, nodes: nodesFor, edges: edgesFor }));
    console.log(`tables-${target}.json: ${nodesFor.filter((node) => node.type === "Entity").length} tables, ${nodesFor.length} nodes, ${edgesFor.length} edges`);
  }
  process.exit(0);
}
const { nodes, edges } = build(copies);
writeFileSync(join(output, "a.json"), JSON.stringify({ ...graph, nodes, edges }));

// The next version: one field gone and one entity described anew, in one copy.
const gone = nodes.find((node) => node.type === "EntityField" && node.id.startsWith("s7."))!;
const entity = nodes.find((node) => node.type === "Entity" && node.id.startsWith("s7."))!;
writeFileSync(
  join(output, "b.json"),
  JSON.stringify({
    ...graph,
    nodes: nodes.filter((node) => node !== gone).map((node) => (node === entity ? { ...node, properties: { ...node.properties, description: "Changed in this version" } } : node)),
    edges: edges.filter((edge) => edge.source_id !== gone.id && edge.target_id !== gone.id),
  }),
);
console.log(`${nodes.length} nodes, ${edges.length} edges`);
