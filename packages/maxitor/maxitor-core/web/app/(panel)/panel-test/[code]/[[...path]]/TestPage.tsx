// packages/maxitor/maxitor-core/web/app/(panel)/panel-test/[code]/[[...path]]/TestPage.tsx
"use client";

import { MaxitorCanvas, PanelPage, useOpenPanel, usePanelPath, usePanelQuery, usePanelRouter, useWatermark, type FilterSection, type Layers } from "@maxitor/panel";
import { useCallback, useMemo, useState } from "react";

export function TestPage() {
  const path = usePanelPath();
  const query = usePanelQuery();
  const router = usePanelRouter();
  const open = useOpenPanel();
  const [watermarks, setWatermarks] = useState<string[]>([]);
  useWatermark(useCallback((at: string) => setWatermarks((was) => [...was, at]), []));
  const { at, ...params } = query;
  const [refusal, setRefusal] = useState("");

  if (path === "/panel-test/canvas") return <TestScene />;
  if (path === "/panel-test/drawing") return <TestDrawing />;
  if (path === "/panel-test/unframed") return <Unframed />;

  return (
    <PanelPage title="Panel test">
      <output data-testid="location">{JSON.stringify({ path, query: params, at: at ?? null })}</output>
      <output data-testid="watermarks">{watermarks.length}</output>
      <div>
        <button type="button" onClick={() => router.push({ query: { ...params, step: String(Number(params.step ?? 0) + 1) } })}>Push a step</button>{" "}
        <button type="button" onClick={() => router.replace({ query: { ...params, search: `${params.search ?? ""}a` } })}>Type a letter</button>{" "}
        <button type="button" onClick={() => router.push({ path: "/panel-test/inner", query: {} })}>Open the inner page</button>{" "}
        <button type="button" onClick={() => open("core", "/settings/plugins")}>Open Settings → Plugins</button>{" "}
        <button type="button" onClick={() => open("stranger", "/")}>Open a stranger&apos;s page</button>{" "}
        <button type="button" onClick={() => router.push({ path: "/panel-test/canvas", query: {} })}>Open the canvas</button>{" "}
        <button type="button" onClick={() => router.push({ path: "/panel-test/drawing", query: {} })}>Open the drawing</button>{" "}
        <button type="button" onClick={() => router.push({ path: "/panel-test/unframed", query: {} })}>Open a page without the shell</button>{" "}
        <button type="button" data-testid="write-mode" onClick={() => { try { router.push({ query: { ...params, mode: "diff" } }); } catch (refused) { setRefusal(String(refused)); } }}>Write mode</button>
      </div>
      <output data-testid="refusal">{refusal}</output>
    </PanelPage>
  );
}

/** A scene of three boxes on the canvas, laid out in canvas coordinates. */
const BOXES = [
  { id: "a", x: 0, y: 0, label: "Payments" },
  { id: "b", x: 600, y: 120, label: "Stock" },
  { id: "c", x: 240, y: 520, label: "Orders" },
];

function TestScene() {
  return (
    <PanelPage title="Test scene">
    <MaxitorCanvas bounds={{ x: 0, y: 0, width: 800, height: 600 }} label="Test scene">
      {BOXES.map((box) => (
        <div key={box.id} data-room-anchor={`box:${box.id}`} className="mx-card" style={{ position: "absolute", left: box.x, top: box.y, width: 200 }}>
          {box.label}
        </div>
      ))}
    </MaxitorCanvas>
    </PanelPage>
  );
}

/** A drawing as a graph's page is (spec 078, FR-024): three layers with counts read from its data, a filter section
 * only in a comparison, a layout choice and a button of its own after the zoom. */
const NODES = [
  { id: "billing", layer: "domains", kind: "core", x: 0, y: 0 },
  { id: "stock", layer: "domains", kind: "edge", x: 320, y: 0 },
  { id: "paid", layer: "events", kind: "core", x: 0, y: 200 },
  { id: "shipped", layer: "events", kind: "edge", x: 320, y: 200 },
  { id: "refunded", layer: "events", kind: "core", x: 640, y: 200 },
  { id: "pay", layer: "actions", kind: "core", x: 0, y: 400 },
];

function TestDrawing() {
  const query = usePanelQuery();
  const [closed, setClosed] = useState(0);
  const layer = query.layer ?? "domains";
  const layers: Layers = {
    default: "domains",
    options: [
      { value: "domains", label: "Domains", icon: "domain", count: NODES.filter((n) => n.layer === "domains").length },
      { value: "events", label: "Events", icon: "event", count: NODES.filter((n) => n.layer === "events").length },
      { value: "actions", label: "Actions", icon: "action", count: NODES.filter((n) => n.layer === "actions").length },
    ],
  };
  const shown = NODES.filter((n) => n.layer === layer);
  const filters = useMemo<FilterSection[]>(() => {
    const kinds: FilterSection = { title: "Kind", param: "kind", paints: true, rows: [{ key: "core", label: "Core", colour: "blue" }, { key: "edge", label: "Edge", colour: "amber", absent: !shown.some((n) => n.kind === "edge") }] };
    // The changes exist only in a comparison: the section is given only when the address has the time scale's mode.
    const changes: FilterSection = { title: "Changes", param: "change", paints: true, rows: [{ key: "added", label: "Added", colour: "green" }, { key: "removed", label: "Removed", colour: "red" }] };
    return query.mode ? [kinds, changes] : [kinds];
  }, [query.mode, shown]);
  return (
    <PanelPage
      title="Test drawing"
      layers={layers}
      filters={filters}
      bar={[
        { kind: "choice", param: "layout", default: "lr", options: [{ value: "lr", title: "Left to right", icon: "layout-lr" }, { value: "tb", title: "Top to bottom", icon: "layout-tb" }] },
        { kind: "button", items: [{ title: "Close every port", icon: "close-ports", onClick: () => setClosed((n) => n + 1) }] },
      ]}
      actions={[{ title: "New note", icon: "plus", onClick: () => setClosed((n) => n + 1) }]}
    >
      <MaxitorCanvas bounds={{ x: 0, y: 0, width: 840, height: 480 }} label="Test drawing">
        {shown.map((node) => (
          <div key={node.id} data-room-anchor={`node:${node.id}`} className="mx-card" style={{ position: "absolute", left: node.x, top: node.y, width: 200 }}>
            {node.id}
          </div>
        ))}
      </MaxitorCanvas>
      <output data-testid="pressed" hidden>{closed}</output>
    </PanelPage>
  );
}

/** A page that does not render the shell: the frame marks it on the stand (spec 078, FR-021). */
function Unframed() {
  return <main data-testid="unframed">A page drawn without the shell.</main>;
}
