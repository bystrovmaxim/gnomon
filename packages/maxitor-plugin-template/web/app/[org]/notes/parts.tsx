// web/app/[org]/notes/parts.tsx — what the template's pages share: the reading again when "now" moved. The cards
// themselves belong to Draft and Published notes, which show different things about a note.
"use client";

import { useWatermark } from "@maxitor/panel";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { newSince } from "./notes";

/**
 * Read the page again when "now" moved, if the page reads now; answers what appeared since the last reading, to mark
 * it new. The first reading marks none.
 */
export function useFresh(ids: readonly string[], now: boolean): Set<string> {
  const router = useRouter();
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const key = ids.join(",");
  useEffect(() => {
    // Counted before the ids read now become the known ones: the state's updater runs later.
    const added = newSince(known.current, ids);
    known.current = new Set(ids);
    if (added.size) setFresh((was) => new Set([...was, ...added]));
  }, [key]);
  useWatermark(
    useCallback(() => {
      if (now) router.refresh();
    }, [now, router]),
  );
  return fresh;
}
