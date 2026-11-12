// packages/maxitor/maxitor-core/web/components/frame/TestFrame.tsx
// The panel's test page laid in the right panel's frame exactly as a plugin's page is.
"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { ComparedFrames } from "@/components/frame/SidePanels";
import { readAddress } from "@/lib/address";

export function TestFrame({ code }: { code: string }) {
  const address = readAddress(usePathname(), useSearchParams());
  if (!address) return null;
  return (
    <ComparedFrames
      code={code}
      address={address}
      owner="core"
      base={`/panel-test/${encodeURIComponent(code)}`}
      title="Panel test"
      canOpen={(owner) => owner === "core"}
      // The test drawing's history is checked as a plugin's is: against these actions and these comparisons.
      historyAllowed={{ actions: ["list_test_notes", "list_test_history", "list_graph_history", "list_odd_history", "test_milestone_card"], compare: ["diff", "side_by_side"] }}
      onTitle={() => undefined}
    />
  );
}
