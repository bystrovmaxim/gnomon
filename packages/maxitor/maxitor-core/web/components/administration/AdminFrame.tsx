"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { ComparedFrames } from "@/components/frame/SidePanels";
import { readAddress } from "@/lib/address";

export function AdminFrame({ code }: { code: string }) {
  const address = readAddress(usePathname(), useSearchParams());
  if (!address) return null;
  return <ComparedFrames code={code} address={address} owner="core" base={`/admin-panel/${encodeURIComponent(code)}`} title="Administration" canOpen={owner => owner === "core"} historyAllowed={{ actions: ["administration_history"], compare: ["diff", "side_by_side"] }} onTitle={() => undefined} />;
}
