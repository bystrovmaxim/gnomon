// @maxitor/panel — previous and next through a comparison's changes (spec 079, FR-025), ported from the graph viewer's
// ChangeStepper: one pill with the look of the scale's — arrows, and a middle saying where one stands that opens the
// list of the changes, each group's name above its changes with their coloured signs. Shift + ↑ ↓ step from
// anywhere, the core passing them on as panel.step. Only the rows that can show are drawn, however long the list.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useChangeStep } from "../hooks";
import { CHANGE_SIGN, changeLines, nextChange, stepperText, type ChangeEntry } from "./changes";

const ROW = 30;
const LIST = 360;
const OVERSCAN = 8;

function Arrow({ by, onStep }: { by: -1 | 1; onStep: (by: -1 | 1) => void }) {
  const label = by < 0 ? "Previous change" : "Next change";
  return (
    <button type="button" className="mx-stepper-arrow" aria-label={label} title={`${label} (Shift + ${by < 0 ? "↑" : "↓"})`} aria-keyshortcuts={by < 0 ? "Shift+ArrowUp" : "Shift+ArrowDown"} onClick={() => onStep(by)}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <path fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d={by < 0 ? "M14.5 6.5 9 12l5.5 5.5" : "M9.5 6.5 15 12l-5.5 5.5"} />
      </svg>
    </button>
  );
}

export function ChangeStepper({ entries, position, onGo, compact = false }: { entries: readonly ChangeEntry[]; position: number | null; onGo: (position: number) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scroll, setScroll] = useState(0);
  const holder = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => changeLines(entries), [entries]);
  const total = entries.length;
  const step = (by: -1 | 1) => total && onGo(nextChange(position, by, total));
  const latest = useRef(step);
  latest.current = step;
  useChangeStep(useMemo(() => (by: -1 | 1) => latest.current(by), []));

  // The list opens a little above the change one stands on; a click outside or Escape closes it.
  useEffect(() => {
    if (!open) return;
    const start = Math.max(0, lines.findIndex((line) => "entry" in line && line.position === position) * ROW - LIST / 3);
    if (list.current) list.current.scrollTop = start;
    setScroll(start);
    const key = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const press = (event: PointerEvent) => !holder.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", press);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", press);
    };
  }, [lines, open, position]);

  if (total === 0) return null;
  const first = Math.max(0, Math.floor(scroll / ROW) - OVERSCAN);
  const last = Math.min(lines.length, first + Math.ceil(LIST / ROW) + 2 * OVERSCAN);
  return (
    <div className={`mx-stepper${open ? " open" : ""}${compact ? " compact" : ""}`} ref={holder} data-stepper role="group" aria-label="Changes">
      <Arrow by={-1} onStep={step} />
      <span className="mx-stepper-hairline" aria-hidden />
      <button type="button" className="mx-stepper-middle" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b>{stepperText(position, total, compact)}</b>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />
        </svg>
      </button>
      <span className="mx-stepper-hairline" aria-hidden />
      <Arrow by={1} onStep={step} />
      {open ? (
        <div className="mx-stepper-list" role="dialog" aria-label="Pick a change" ref={list} onScroll={(event) => setScroll(event.currentTarget.scrollTop)}>
          <div style={{ height: lines.length * ROW }} className="mx-stepper-rows">
            {lines.slice(first, last).map((line, index) => {
              const top = (first + index) * ROW;
              if (!("entry" in line)) {
                return (
                  <div key={`group-${first + index}`} className="mx-stepper-group" style={{ top }}>
                    {line.group}
                  </div>
                );
              }
              const { entry } = line;
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={`mx-stepper-row${line.position === position ? " on" : ""}`}
                  aria-current={line.position === position || undefined}
                  style={{ top }}
                  onClick={() => {
                    setOpen(false);
                    onGo(line.position);
                  }}
                >
                  <span className="mx-diff-sign" data-status={entry.status}>{CHANGE_SIGN[entry.status]}</span>
                  <span className="mx-stepper-title">{entry.title}</span>
                  {entry.detail ? <span className="mx-stepper-detail">{entry.detail}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
