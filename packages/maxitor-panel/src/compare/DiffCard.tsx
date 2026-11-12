// @maxitor/panel — the card of one change (spec 079, FR-025), ported from the graph viewer's DiffCard: the element's
// title and its StatusIcon; "Added in B" or "Removed in B" for a whole element; for a changed one every property that
// differs, its path, the value before struck and the one after; parts changed inside it below, by group. Values are
// text, never markup. A click outside or Escape closes it; a click on the stepper moves it on.
"use client";

import { useEffect, useRef } from "react";

import { CHANGE_SIGN, type Change } from "./changes";
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

export function DiffCard({ target, newer = "B", at, onClose }: { target: DiffTarget; newer?: string; at: { x: number; y: number }; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null);
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
    <div ref={card} className="mx-diff-card" role="dialog" aria-label={`What changed in ${target.title}`} style={{ left: at.x, top: at.y }}>
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
