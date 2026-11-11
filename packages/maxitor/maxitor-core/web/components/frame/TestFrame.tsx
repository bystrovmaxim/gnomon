// packages/maxitor/maxitor-core/web/components/frame/TestFrame.tsx
// The panel's test page laid in the right panel's frame exactly as a plugin's page is.
"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { Controls } from "@/components/frame/Controls";
import { PageFrame } from "@/components/frame/PageFrame";
import { readAddress } from "@/lib/address";
import type { Controls as Declared } from "@/lib/tree";

/** One control of every kind, with fixed options: the controls are checked without a plugin's source. */
const TEST_CONTROLS: Declared = {
  mode: { param: "mode", default: "all", options: [{ value: "all", label: "All" }, { value: "recent", label: "Recent" }] },
  views: { param: "view", default: "list", options: [{ value: "list", label: "List" }, { value: "table", label: "Table" }] },
  filters: [
    { title: "Kind", param: "kind", options: [{ value: "a", label: "Alpha", colour: "green" }, { value: "b", label: "Beta", colour: "blue" }, { value: "c", label: "Gamma", colour: "red" }] },
    { title: "State", param: "state", options: [{ value: "open", label: "Open", colour: "amber" }, { value: "closed", label: "Closed", colour: "grey" }] },
  ],
  legend: { title: "Kind", items: [{ label: "Alpha", colour: "green" }, { label: "Beta", colour: "blue" }, { label: "Gamma", colour: "red" }] },
};

export function TestFrame({ code }: { code: string }) {
  const address = readAddress(usePathname(), useSearchParams());
  if (!address) return null;
  return (
    <>
    <PageFrame
      code={code}
      address={address}
      owner="core"
      base={`/panel-test/${encodeURIComponent(code)}`}
      title="Panel test"
      canOpen={(owner) => owner === "core"}
      onTitle={() => undefined}
    />
    {address.path === "/panel-test" ? <Controls code={code} owner="core" controls={TEST_CONTROLS} address={address} scope={{}} /> : null}
    </>
  );
}
