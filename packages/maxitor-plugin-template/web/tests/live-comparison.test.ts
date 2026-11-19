import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(new URL("../../../maxitor/maxitor-core/web/package.json", import.meta.url));
const ts = require("typescript");
const compile = (file: string) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const published = compile("../app/[org]/items/[item_id]/published/PublishedView.tsx");
const parts = compile("../app/[org]/notes/parts.tsx");

test("Published refreshes live One, Diff and B content, while fixed dates and A stay unchanged", () => {
  for (const side of [null, "b", "a"]) for (const comparing of [false, true]) {
    for (const at of [undefined, "2026-11-19T10:00:00.123456Z"]) {
      // A is always an explicit historical timestamp, even when B follows Now.
      const query = { at: side === "a" ? "2026-11-19T09:00:00.000000Z" : at };
      const listeners: Array<(watermark: string) => void> = [];
      let reads = 0;
      const router = { refresh: () => reads++ };
      const react = { useCallback: (fn: unknown) => fn, useEffect() {},
        useRef: (current: unknown) => ({ current }), useState: (value: unknown) => [value, () => {}] };
      const panel = { usePanelQuery: () => query, useMoment: () => ({ side }), usePanelRouter: () => ({}),
        usePanelPath: () => "/items/test/published", useWatermark: (fn: (at: string) => void) => listeners.push(fn) };
      const hooks: any = {}, view: any = {}, stop = Symbol("fresh hook captured");
      runInNewContext(parts, { exports: hooks, require: (id: string) => id === "react" ? react
        : id === "@maxitor/panel" ? panel : id === "next/navigation" ? { useRouter: () => router } : {} });
      runInNewContext(published, { exports: view, require: (id: string) => id === "react" ? react
        : id === "@maxitor/panel" ? panel : id === "next/navigation" ? { useRouter: () => router }
        : id === "../../../notes/parts" ? { useFresh: (ids: string[], live: boolean) => { hooks.useFresh(ids, live); throw stop; } } : {} });
      assert.throws(() => view.PublishedView({ notes: [{ id: "note" }], other: comparing ? [{ id: "note" }] : null }), error => error === stop);
      assert.equal(listeners.length, 1);
      listeners[0]("2026-11-19T10:05:00.654321Z");
      assert.equal(reads, query.at ? 0 : 1, `side=${side}, comparison=${comparing}, at=${query.at ?? "Now"}`);
    }
  }
});
