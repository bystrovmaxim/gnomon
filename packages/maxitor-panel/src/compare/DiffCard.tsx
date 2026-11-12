// @maxitor/panel — the card of one change (spec 079, FR-025), ported from the graph viewer's DiffCard: the element's
// title and its StatusIcon; "Added in B" or "Removed in B" for a whole element; for a changed one every property that
// differs, its path, the value before struck and the one after; parts changed inside it below, by group. Values are
// text, never markup. Given an anchor it stands beside that element as the graph viewer's does, following it while the
// camera brings it into view. A click outside or Escape closes it; a click on the stepper moves it on.
"use client";

import { useEffect, useRef, useState } from "react";

import { CHANGE_SIGN, type Change } from "./changes";
import { besideBox } from "./place";
import { StatusIcon } from "./StatusIcon";

/** One property that changed: its path and its value before and after. */
export type Difference = { path: string[]; change: Change; before?: unknown; after?: unknown };
/** A part changed inside an element: its group, what happened to it, its label and its own differences. */
export type ChangedPart = { group: string; status: Change; label: string; differences: Difference[] };
/** What a card shows: the element, what happened, and — for a changed one — its differences, null while they are read. */
export type DiffTarget = { title: string; status: Change; differences?: Difference[] | null; parts?: ChangedPart[]; note?: string };

/** A value as the card writes it: text as it is, anything else as JSON — never as markup. */
export function shownValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function DifferenceRow({ difference }: { difference: Difference }) {
  return (
    <div className="mx-diff-row">
      <span className="mx-diff-path">{difference.path.join(".")}</span>
      <span>
        {difference.change === "added" ? (
          <>added: {shownValue(difference.after)}</>
        ) : difference.change === "removed" ? (
          <>removed: {shownValue(difference.before)}</>
        ) : (
          <>
            <s>{shownValue(difference.before)}</s> → {shownValue(difference.after)}
          </>
        )}
      </span>
    </div>
  );
}

/** The parts by the group they belong to, in the order they came. */
function grouped(parts: readonly ChangedPart[]): [string, ChangedPart[]][] {
  const groups = new Map<string, ChangedPart[]>();
  for (const part of parts) groups.set(part.group, [...(groups.get(part.group) ?? []), part]);
  return [...groups];
}

export function DiffCard({
  target,
  newer = "B",
  at,
  beside,
  onClose,
}: {
  target: DiffTarget;
  newer?: string;
  /** Where the card stands in the panel's pixels, until it finds the element of `beside` and whenever it is out of sight. */
  at: { x: number; y: number };
  /** The anchor of the element the card describes, as `data-room-anchor` names it: the card stands beside it. */
  beside?: string;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState(at);
  // Beside its element, read every frame while the card is open, since the camera may still be gliding to it.
  useEffect(() => {
    if (!beside) {
      setPlace(at);
      return;
    }
    let frame = 0;
    const follow = () => {
      const element = document.querySelector(`[data-room-anchor="${CSS.escape(beside)}"]`);
      const own = card.current;
      const panel = own?.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
      const box = element?.getBoundingClientRect();
      const next = own && box && box.right > panel.left && box.left < panel.right ? besideBox(panel, box, own.offsetWidth, own.offsetHeight) : at;
      setPlace((was) => (Math.abs(was.x - next.x) < 0.5 && Math.abs(was.y - next.y) < 0.5 ? was : next));
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [beside, at.x, at.y]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const press = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (card.current?.contains(target) || target?.closest?.("[data-stepper]")) return;
      onClose();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", press);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", press);
    };
  }, [onClose]);

  const parts = grouped(target.parts ?? []);
  const inside = parts.length > 0;
  return (
    <div ref={card} className="mx-diff-card" role="dialog" aria-label={`What changed in ${target.title}`} style={{ left: place.x, top: place.y }}>
      <div className="mx-diff-head">
        <span>{target.title}</span>
        <StatusIcon status={target.status} />
      </div>
      {target.status === "added" ? <div>{`Added in ${newer}`}</div> : null}
      {target.status === "removed" ? <div>{`Removed in ${newer}`}</div> : null}
      {target.status === "changed" && target.differences === null ? <div className="mx-diff-quiet">Reading…</div> : null}
      {target.note ? <div>{target.note}</div> : null}
      {target.status === "changed" && !inside && !target.note && target.differences?.length === 0 ? <div className="mx-diff-quiet">No property differs.</div> : null}
      {target.differences?.map((difference) => <DifferenceRow key={difference.path.join(".")} difference={difference} />)}
      {parts.map(([group, members]) => (
        <div key={group} className="mx-diff-group">
          <div className="mx-diff-group-name">{group}</div>
          {members.map((part) => (
            <div key={`${part.status}|${part.label}`}>
              <span className="mx-diff-sign" data-status={part.status}>{CHANGE_SIGN[part.status]}</span> {part.label}
              {part.differences.map((difference) => <DifferenceRow key={difference.path.join(".")} difference={difference} />)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
