// web/app/[org]/notes/parts.tsx — what the template's pages share: the reading again when "now" moved, a card's writer
// and the stepper's step brought into view. The cards themselves belong to Draft and Published, which show different
// things about a note.
"use client";

import { PersonDisk, useCanvas, useWatermark } from "@maxitor/panel";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { paletteOf } from "../items/[item_id]/people";
import { newSince } from "./notes";

/**
 * A card's writer, as every card names them: their disk in their own colour, their name and under it the time, each
 * cut short with an ellipsis in a narrow card and said whole on hover.
 */
export function Writer({ id, name, time }: { id: string; name: string; time: string }) {
  return (
    <span className="nt-writer" title={`${name} · ${time}`}>
      <PersonDisk name={name} colour={paletteOf(id)} />
      <span className="nt-who">
        <b>{name}</b>
        <span>{time}</span>
      </span>
    </span>
  );
}

/** The stepper's step brought into the middle of the canvas, keeping the zoom. */
export function Bring({ anchor }: { anchor: string | null }) {
  // Only a new step moves the camera: the canvas changes with every move, so it is read, not watched.
  const api = useCanvas();
  const canvas = useRef(api);
  canvas.current = api;
  useEffect(() => {
    if (anchor) canvas.current.bring(anchor);
  }, [anchor]);
  return null;
}

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
