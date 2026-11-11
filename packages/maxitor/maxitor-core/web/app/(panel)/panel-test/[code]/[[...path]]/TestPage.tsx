// packages/maxitor/maxitor-core/web/app/(panel)/panel-test/[code]/[[...path]]/TestPage.tsx
"use client";

import { MaxitorCanvas, PanelPage, useOpenPanel, usePanelPath, usePanelQuery, usePanelRouter, useWatermark } from "@maxitor/panel";
import { useCallback, useState } from "react";

export function TestPage() {
  const path = usePanelPath();
  const query = usePanelQuery();
  const router = usePanelRouter();
  const open = useOpenPanel();
  const [watermarks, setWatermarks] = useState<string[]>([]);
  useWatermark(useCallback((at: string) => setWatermarks((was) => [...was, at]), []));
  const { at, ...params } = query;

  if (path === "/panel-test/canvas") return <TestScene />;

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
        <button type="button" onClick={() => router.push({ path: "/panel-test/canvas", query: {} })}>Open the canvas</button>
      </div>
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
    <MaxitorCanvas bounds={{ x: 0, y: 0, width: 800, height: 600 }} label="Test scene">
      {BOXES.map((box) => (
        <div key={box.id} data-room-anchor={`box:${box.id}`} className="mx-card" style={{ position: "absolute", left: box.x, top: box.y, width: 200 }}>
          {box.label}
        </div>
      ))}
    </MaxitorCanvas>
  );
}
