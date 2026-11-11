// @maxitor/panel — the filters at the top left, made from maxitor-web's ErdFilterPanel (spec 078, FR-003): an
// accordion with one section open, a colour disk and a label per row, a faint row absent from the data, and the
// paint switch at its foot when more than one section can paint. On a phone they fold behind a button.
"use client";

import { PALETTE, paletteColour, type PaletteColour } from "@maxitor/tokens";
import { useState } from "react";

import type { Query } from "../protocol";
import { chosen, filterOn, PAINT, toggleFilter, writeChoice } from "./address";
import { Icon } from "./icons";
import type { FilterSection } from "./types";

type Write = (name: string, value: string | null) => void;

function colourOf(name: string | undefined): string {
  return paletteColour((PALETTE as readonly string[]).includes(name ?? "") ? (name as PaletteColour) : "grey");
}

export function Filters({ sections, query, write }: { sections: FilterSection[]; query: Query; write: Write }) {
  const painting = sections.filter((section) => section.paints);
  const paint = chosen(query[PAINT], painting[0]?.param ?? "", painting.map((section) => section.param));
  const [open, setOpen] = useState(() => Math.max(0, sections.findIndex((section) => section.param === paint)));
  const [folded, setFolded] = useState(true);
  const switchedOff = sections.filter((section) => query[section.param] !== undefined).length;
  return (
    <aside className={`mx-filters${folded ? " folded" : ""}`} aria-label="Filters" data-shell="filters">
      <button type="button" className="mx-filters-button" aria-expanded={!folded} onClick={() => setFolded(!folded)}>
        Filters{switchedOff ? <span className="mx-count">{switchedOff}</span> : null}
      </button>
      <div className="mx-filters-body">
        {sections.map((section, index) => (
          <section key={section.param} className="mx-filter">
            <button type="button" className="mx-filter-title" aria-expanded={index === open} onClick={() => setOpen(index === open ? -1 : index)}>
              <Icon name="chevron" />
              {section.title}
            </button>
            {index === open ? <Rows section={section} listed={query[section.param]} write={write} /> : null}
          </section>
        ))}
        {painting.length > 1 ? (
          <div className="mx-paint" role="radiogroup" aria-label="Paint by">
            {painting.map((section) => (
              <button
                key={section.param}
                type="button"
                role="radio"
                aria-checked={section.param === paint}
                title={`Paint by ${section.title}`}
                className={section.param === paint ? "on" : ""}
                onClick={() => write(PAINT, writeChoice(section.param, painting[0].param))}
              >
                <span />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function Rows({ section, listed, write }: { section: FilterSection; listed: string | undefined; write: Write }) {
  if (section.rows.length === 0) return <div className="mx-filter-note">Nothing to filter by.</div>;
  const keys = section.rows.map((row) => row.key);
  const on = filterOn(listed, keys);
  return (
    <div className="mx-filter-rows">
      {section.rows.map((row) => (
        <button
          key={row.key}
          type="button"
          role="checkbox"
          aria-checked={on.has(row.key)}
          className={`mx-filter-row${on.has(row.key) ? "" : " off"}${row.absent ? " absent" : ""}`}
          onClick={() => write(section.param, toggleFilter(listed, keys, row.key))}
        >
          <span className="mx-disk" style={{ background: colourOf(row.colour) }}>{row.mark ?? ""}</span>
          <span className="mx-filter-label">{row.label}</span>
        </button>
      ))}
    </div>
  );
}
