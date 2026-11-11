// packages/maxitor/maxitor-core/web/components/frame/TestFrame.tsx
// The panel's test page laid in the right panel's frame exactly as a plugin's page is.
"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { PageFrame } from "@/components/frame/PageFrame";
import { readAddress } from "@/lib/address";

export function TestFrame({ code }: { code: string }) {
  const address = readAddress(usePathname(), useSearchParams());
  if (!address) return null;
  return (
    <PageFrame
      code={code}
      address={address}
      owner="core"
      base={`/panel-test/${encodeURIComponent(code)}`}
      title="Panel test"
      canOpen={(owner) => owner === "core"}
      onTitle={() => undefined}
    />
  );
}
