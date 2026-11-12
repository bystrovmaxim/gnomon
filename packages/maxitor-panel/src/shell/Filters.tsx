// @maxitor/panel — the filters at the top left, made from maxitor-web's ErdFilterPanel (spec 078, FR-003; spec 081,
// FR-006 – FR-012): an accordion with one section open, of three kinds — a choice of values, a text, a range — and
// the paint switch at its foot when more than one section can paint. A long choice shows a search, its first values
// and "N more"; a range shows two rows, a number typed in place, a date chosen in the date range picker. The wheel
// over the filters scrolls them, never the canvas. On a phone they are one button opening a sheet from below.
"use client";

import { PALETTE, paletteColour, type PaletteColour } from "@maxitor/tokens";
import { useEffect, useRef, useState } from "react";

import { openDateRangePicker } from "../pickers/DatePickers";
import { boundDate, howSet, readRange, writeRange } from "../pickers/dates";
import type { Query } from "../protocol";
import { chosen, filterOn, filtersOn, PAINT, readNumbers, toggleFilter, visibleRows, writeChoice, writeNumbers } from "./address";
import { Icon } from "./icons";
import type { ChoiceFilter, FilterSection, RangeFilter, TextFilter } from "./types";

type Write = (name: string, value: string | null) => void;

/** The status signs a disk may carry; a sign is drawn larger than a person's initials, as the graph viewer's disks are. */
const SIGNS = new Set(["+", "−", "~", "="]);

/** How long typing in a text waits before it is written, so one search is one history entry. */
const TYPING_MS = 400;

function colourOf(name: string | undefined): string {
  return paletteColour((PALETTE as readonly string[]).includes(name ?? "") ? (name as PaletteColour) : "grey");
}

function Magnifier() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </svg>
  );
}

function Hash() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M9.5 4L7.5 20M16.5 4l-2 16M4.5 9h16M3.5 15h16" />
    </svg>
  );
}

function CalendarMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  );
}

export function Filters({ sections, query, write }: { sections: FilterSection[]; query: Query; write: Write }) {
  const painting = sections.filter((section): section is ChoiceFilter => (section.kind ?? "choice") === "choice" && Boolean((section as ChoiceFilter).paints));
  const paint = chosen(query[PAINT], painting[0]?.param ?? "", painting.map((section) => section.param));
  const [open, setOpen] = useState(() => Math.max(0, sections.findIndex((section) => section.param === paint)));
  const [folded, setFolded] = useState(true);
  const on = filtersOn(sections.map((section) => section.param), query);
  const panel = useRef<HTMLElement>(null);
  return (
    <>
      <aside ref={panel} className={`mx-filters${folded ? " folded" : ""}`} aria-label="Filters" data-shell="filters" onWheel={(event) => event.stopPropagation()}>
        {!folded ? <div className="mx-filters-scrim" onClick={() => setFolded(true)} /> : null}
        <button type="button" className="mx-filters-button" aria-expanded={!folded} onClick={() => setFolded(!folded)}>
          Filters{on ? <span className="mx-count">{on}</span> : null}
        </button>
        <div className="mx-filters-body">
          <div className="mx-filters-sheet-head">
            <b>Filters</b>
            <button type="button" onClick={() => setFolded(true)}>Done</button>
          </div>
          {sections.map((section, index) => (
            <section key={section.param} className="mx-filter" data-filter={section.param}>
              <button type="button" className="mx-filter-title" aria-expanded={index === open} onClick={() => setOpen(index === open ? -1 : index)}>
                <Icon name="chevron" />
                {section.title}
              </button>
              {index === open ? <Section section={section} query={query} write={write} panel={panel} /> : null}
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
                  onClick={() => {
                    write(PAINT, writeChoice(section.param, painting[0].param));
                    setOpen(sections.indexOf(section));
                  }}
                >
                  <span />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function Section({ section, query, write, panel }: { section: FilterSection; query: Query; write: Write; panel: React.RefObject<HTMLElement | null> }) {
  if (section.kind === "text") return <Text section={section} value={query[section.param] ?? ""} write={write} />;
  if (section.kind === "range" && section.unit === "number") return <Numbers section={section} value={query[section.param]} write={write} />;
  if (section.kind === "range") return <Dates section={section} value={query[section.param]} write={write} panel={panel} />;
  return <Choice section={section} listed={query[section.param]} write={write} />;
}

function Choice({ section, listed, write }: { section: ChoiceFilter; listed: string | undefined; write: Write }) {
  const [search, setSearch] = useState("");
  const [unfolded, setUnfolded] = useState(false);
  if (section.rows.length === 0) return <div className="mx-filter-note">Nothing to filter by.</div>;
  const keys = section.rows.map((row) => row.key);
  const on = filterOn(listed, keys);
  const long = section.rows.length > 8;
  const { rows, more } = visibleRows(section.rows, search, unfolded);
  return (
    <div className="mx-filter-rows">
      {long ? (
        <label className={`mx-filter-row field${search ? " on" : ""}`}>
          <span className="mx-disk mark"><Magnifier /></span>
          <input className="mx-filter-input" value={search} placeholder={section.search ?? `Find in ${section.title.toLowerCase()}`} onChange={(event) => setSearch(event.currentTarget.value)} />
        </label>
      ) : null}
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          role="checkbox"
          aria-checked={on.has(row.key)}
          className={`mx-filter-row${on.has(row.key) ? "" : " off"}${row.absent ? " absent" : ""}`}
          onClick={() => write(section.param, toggleFilter(listed, keys, row.key))}
        >
          <span className={`mx-disk${SIGNS.has(row.mark ?? "") ? " sign" : ""}`} style={{ background: colourOf(row.colour) }}>{row.mark ?? ""}</span>
          <span className="mx-filter-label" title={row.label}>{row.label}</span>
        </button>
      ))}
      {more ? <button type="button" className="mx-filter-more" onClick={() => setUnfolded(true)}>{more} more</button> : null}
      {long && unfolded && !search ? <button type="button" className="mx-filter-more" onClick={() => setUnfolded(false)}>Show fewer</button> : null}
      {search && rows.length === 0 ? <div className="mx-filter-note">No {section.title.toLowerCase()} matches</div> : null}
    </div>
  );
}

function Text({ section, value, write }: { section: TextFilter; value: string; write: Write }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const timer = useRef(0);
  return (
    <div className="mx-filter-rows">
      <label className={`mx-filter-row field${text ? " on" : ""}`}>
        <span className="mx-disk mark"><Magnifier /></span>
        <input
          className="mx-filter-input"
          value={text}
          placeholder={section.placeholder}
          aria-label={section.title}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setText(next);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => write(section.param, next.trim() ? next : null), TYPING_MS);
          }}
        />
      </label>
    </div>
  );
}

function Numbers({ section, value, write }: { section: RangeFilter; value: string | undefined; write: Write }) {
  const [from, to] = value?.includes("..") ? value.split("..", 2) : ["", ""];
  const [typed, setTyped] = useState({ from, to });
  useEffect(() => setTyped({ from, to }), [from, to]);
  const commit = (next: { from: string; to: string }) => {
    const written = writeNumbers(next.from, next.to);
    if (written !== (value ?? null)) write(section.param, written);
  };
  const { from: low, to: high } = readNumbers(value);
  const row = (which: "from" | "to") => (
    <label className={`mx-filter-row field${(which === "from" ? low : high) !== null ? " on" : ""}`}>
      <span className="mx-disk mark"><Hash /></span>
      <span className="mx-filter-pre">{which === "from" ? "From" : "To"}</span>
      <input
        className="mx-filter-input number"
        inputMode="decimal"
        aria-label={`${section.title} ${which === "from" ? "from" : "to"}`}
        placeholder="any"
        value={typed[which]}
        onChange={(event) => setTyped({ ...typed, [which]: event.currentTarget.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        onBlur={() => commit(typed)}
      />
    </label>
  );
  return (
    <div className="mx-filter-rows">
      {row("from")}
      {row("to")}
    </div>
  );
}

function Dates({ section, value, write, panel }: { section: RangeFilter; value: string | undefined; write: Write; panel: React.RefObject<HTMLElement | null> }) {
  const range = readRange(value);
  const [opened, setOpened] = useState(false);
  const choose = async () => {
    if (opened || !panel.current) return;
    setOpened(true);
    const chosenRange = await openDateRangePicker({ anchor: panel.current, min: section.min, max: section.max, value: range, presets: section.presets });
    setOpened(false);
    if (chosenRange) write(section.param, writeRange(chosenRange));
  };
  const row = (which: "from" | "to") => {
    const bound = range[which];
    const how = bound ? howSet(bound, which === "to") : "";
    return (
      <button type="button" className={`mx-filter-row field${bound ? " on" : ""}${opened ? " open" : ""}`} onClick={choose} data-bound={which}>
        <span className="mx-disk mark"><CalendarMark /></span>
        <span className="mx-filter-label">
          <span className="mx-filter-pre">{which === "from" ? "From " : "To "}</span>
          {boundDate(bound, which === "to")}
          {how ? <span className="mx-filter-how">{how}</span> : null}
        </span>
        {bound ? (
          <span
            className="mx-filter-clear"
            role="button"
            aria-label={`Clear ${which === "from" ? "from" : "to"}`}
            onClick={(event) => {
              event.stopPropagation();
              write(section.param, writeRange({ ...range, [which]: "" }));
            }}
          >
            ×
          </span>
        ) : null}
      </button>
    );
  };
  return (
    <div className="mx-filter-rows">
      {row("from")}
      {row("to")}
    </div>
  );
}
