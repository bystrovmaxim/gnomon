// @maxitor/panel — what lies between A and B (spec 079, FR-016), ported from the graph viewer's VersionsBetween: one
// line, "N publications between", absent when A and B are neighbours; it opens them newest first, each row its
// reference and its first line, a click on a row opening its whole text.
"use client";

import { useState } from "react";

export type Between = { key: string; ref: string; title: string; text?: string };

export function VersionsBetween({ items, noun = ["version", "versions"] }: { items: readonly Between[]; noun?: [string, string] }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  if (items.length === 0) return null;
  return (
    <div className="mx-between-list">
      <button type="button" className="mx-between-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "▾" : "▸"} {items.length === 1 ? `1 ${noun[0]} between` : `${items.length} ${noun[1]} between`}
      </button>
      {open ? (
        <ul aria-label={`${noun[1]} between`}>
          {[...items].reverse().map((item) => (
            <li key={item.key}>
              <button type="button" aria-expanded={shown === item.key} onClick={() => setShown(shown === item.key ? null : item.key)}>
                <b>{item.ref}</b>
                <span>{item.title}</span>
              </button>
              {shown === item.key && item.text ? <div className="mx-between-text">{item.text}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
