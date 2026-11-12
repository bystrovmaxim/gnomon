// @maxitor/panel — the date range picker and the date picker (spec 081, FR-014 – FR-019, FR-021): Apple's layout in
// Maxitor's colours and sizes, as the mockup of spec 079 draws them. The ready stretches on the left, the fields
// that take typing, two months (one on a phone, and for one date), wheels behind a month's title, the foot with the
// choice in words. Nothing changes before Apply; Cancel, Escape and a press outside give nothing back. A plugin
// opens either picker by calling a function and gets the choice back as the address writes it.
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import {
  addMonths,
  boundDate,
  DATE_PRESETS,
  highest,
  howSet,
  isMoving,
  lowest,
  monthGrid,
  MONTHS_FULL,
  parseTyped,
  pickDay,
  RANGE_PRESETS,
  rangeSummary,
  resolve,
  today,
  toggleMoving,
  typeBound,
  viewMonth,
  WEEKDAYS,
  weekdayLabel,
  type Bound,
  type Preset,
  type Range,
  type Unit,
} from "./dates";
import "./pickers.css";

/** Where a picker opens: beside an element, or beside a box on the screen. */
export type Anchor = Element | DOMRect;

export type RangePickerOptions = {
  anchor: Anchor;
  unit?: Unit;
  /** The first day or month a choice may take; none when absent. */
  min?: Bound;
  /** The last day or month a choice may take; none when absent. */
  max?: Bound;
  value?: Range;
  /** The page's own ready stretches, under the core's. */
  presets?: Preset[];
};

export type DatePickerOptions = Omit<RangePickerOptions, "value"> & { value?: Bound };

/** The width at and under which a picker is a sheet from below. */
const PHONE = 520;
/** The rows the wheels draw beyond the bounds, pale, so the wheels are full either way. */
const WHEEL_PAD = 3;
const WHEEL_ROW = 28;

function isPhone(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= PHONE;
}

function Chevron({ d }: { d: string }) {
  return (
    <svg width="9" height="14" viewBox="0 0 9 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function MovingIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 10-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

/** One month's grid: round days, a band between the ends, the month's title opening the wheels. */
function Month({
  month,
  min,
  max,
  from,
  to,
  now,
  onPick,
  onJump,
  nav,
}: {
  month: string;
  min: string;
  max: string;
  from: string;
  to: string;
  now: string;
  onPick: (day: string) => void;
  onJump: () => void;
  nav?: ReactNode;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [year, number] = month.split("-").map(Number);
  const both = Boolean(from && to && from !== to);
  return (
    <div className="mx-cal-month" onMouseLeave={() => setHover(null)}>
      <div className="mx-cal-head">
        <button type="button" className="mx-cal-title" onClick={onJump}>
          {MONTHS_FULL[number - 1]} {year}
          <span className="mx-cal-chevron"><Chevron d="M2 2l5 5-5 5" /></span>
        </button>
        {nav}
      </div>
      <div className="mx-cal-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="mx-cal-grid">
        {monthGrid(month).map(({ day, inMonth }) => {
          if (!inMonth) return <span key={day} className="mx-cal-day empty" />;
          const disabled = Boolean((min && day < min) || (max && day > max));
          const names = [
            "mx-cal-day",
            disabled ? "disabled" : "",
            day === now ? "today" : "",
            day === from || day === to ? "chosen" : "",
            both && day > from && day < to ? "inside" : "",
            both && day === from ? "starts" : "",
            both && day === to ? "ends" : "",
            day === hover && !disabled ? "hover" : "",
          ].filter(Boolean).join(" ");
          return (
            <button key={day} type="button" className={names} disabled={disabled} data-day={day} onClick={() => onPick(day)} onMouseEnter={() => setHover(day)}>
              <span>{Number(day.slice(8))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Nav({ month, min, max, shown, onMove }: { month: string; min: string; max: string; shown: number; onMove: (by: number) => void }) {
  const canBack = !min || month > min.slice(0, 7);
  const canOn = !max || addMonths(month, shown - 1) < max.slice(0, 7);
  return (
    <span className="mx-cal-nav">
      <button type="button" aria-label="Previous month" disabled={!canBack} onClick={() => onMove(-1)}><Chevron d="M7 2L2 7l5 5" /></button>
      <button type="button" aria-label="Next month" disabled={!canOn} onClick={() => onMove(1)}><Chevron d="M2 2l5 5-5 5" /></button>
    </span>
  );
}

/** The years a wheel shows: the allowed ones and a few pale ones either side. */
function wheelYears(min: string, max: string, around: number): number[] {
  const first = (min ? Number(min.slice(0, 4)) : around - 10) - WHEEL_PAD;
  const last = (max ? Number(max.slice(0, 4)) : around + 10) + WHEEL_PAD;
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

/** Two wheels to jump to a month: the months going round, the years outside the bounds pale; where they stop is shown. */
function Wheels({ month, min, max, onStop, onClose }: { month: string; min: string; max: string; onStop: (month: string) => void; onClose: () => void }) {
  const [year, number] = month.split("-").map(Number);
  const years = useMemo(() => wheelYears(min, max, year), [min, max, year]);
  const months = useRef<HTMLDivElement>(null);
  const yearsWheel = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(month);

  useLayoutEffect(() => {
    if (months.current) months.current.scrollTop = (12 + number - 1) * WHEEL_ROW;
    if (yearsWheel.current) yearsWheel.current.scrollTop = (year - years[0]) * WHEEL_ROW;
  }, []);

  const settle = useRef(0);
  const stopped = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const monthsEl = months.current;
      const yearsEl = yearsWheel.current;
      if (!monthsEl || !yearsEl) return;
      const index = Math.round(monthsEl.scrollTop / WHEEL_ROW) % 12;
      // The months' wheel is kept on its middle turn, so it never runs out either way.
      if (Math.round(monthsEl.scrollTop / WHEEL_ROW) !== 12 + index) monthsEl.scrollTop = (12 + index) * WHEEL_ROW;
      let next = `${years[Math.round(yearsEl.scrollTop / WHEEL_ROW)]}-${String(index + 1).padStart(2, "0")}`;
      const first = min ? min.slice(0, 7) : "";
      const last = max ? max.slice(0, 7) : "";
      if ((first && next < first) || (last && next > last)) {
        next = first && next < first ? first : last;
        const [nextYear, nextMonth] = next.split("-").map(Number);
        monthsEl.scrollTo({ top: (12 + nextMonth - 1) * WHEEL_ROW, behavior: "smooth" });
        yearsEl.scrollTo({ top: (nextYear - years[0]) * WHEEL_ROW, behavior: "smooth" });
      }
      setShown(next);
      onStop(next);
    }, 110);
  };

  const [shownYear, shownMonth] = shown.split("-").map(Number);
  const firstYear = min ? Number(min.slice(0, 4)) : -Infinity;
  const lastYear = max ? Number(max.slice(0, 4)) : Infinity;
  const go = (element: HTMLDivElement | null, index: number) => element?.scrollTo({ top: index * WHEEL_ROW, behavior: "smooth" });
  return (
    <div className="mx-cal-month">
      <div className="mx-cal-head">
        <button type="button" className="mx-cal-title open" onClick={onClose}>
          {MONTHS_FULL[shownMonth - 1]} {shownYear}
          <span className="mx-cal-chevron"><Chevron d="M2 2l5 5-5 5" /></span>
        </button>
      </div>
      <div className="mx-cal-wheels">
        <div className="mx-cal-band" />
        <div className="mx-cal-wheel months" ref={months} onScroll={stopped} data-wheel="months">
          <div className="mx-cal-wheel-pad" />
          {[0, 1, 2].flatMap((turn) => MONTHS_FULL.map((name, index) => (
            <div key={`${turn}-${name}`} className={`mx-cal-wheel-item${index === shownMonth - 1 ? " on" : ""}`} onClick={() => go(months.current, turn * 12 + index)}>{name}</div>
          )))}
          <div className="mx-cal-wheel-pad" />
        </div>
        <div className="mx-cal-wheel years" ref={yearsWheel} onScroll={stopped} data-wheel="years">
          <div className="mx-cal-wheel-pad" />
          {years.map((each, index) => (
            <div key={each} className={`mx-cal-wheel-item${each === shownYear ? " on" : ""}${each < firstYear || each > lastYear ? " off" : ""}`} onClick={() => go(yearsWheel.current, index)}>{each}</div>
          ))}
          <div className="mx-cal-wheel-pad" />
        </div>
      </div>
    </div>
  );
}

function Presets({ core, own, chosen, onPick }: { core: Preset[]; own: Preset[]; chosen: (preset: Preset) => boolean; onPick: (preset: Preset) => void }) {
  const list = (presets: Preset[]) =>
    presets.map((preset) => (
      <button key={preset.label} type="button" className={chosen(preset) ? "on" : ""} onClick={() => onPick(preset)}>{preset.label}</button>
    ));
  return (
    <div className="mx-cal-presets">
      {list(core)}
      {own.length ? <div className="mx-cal-presets-line" /> : null}
      {list(own)}
    </div>
  );
}

/** A field that takes typing: its date shown, how a moving bound is set under it, the arrow fixing or moving it. */
function Field({
  label,
  bound,
  end,
  active,
  now,
  placeholder,
  onFocus,
  onType,
  onToggle,
}: {
  label: string;
  bound: Bound;
  end: boolean;
  active: boolean;
  now: string;
  placeholder: string;
  onFocus: () => void;
  onType: (text: string) => void;
  onToggle: () => void;
}) {
  const shown = bound ? boundDate(bound, end, now) : "";
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const moving = Boolean(bound) && isMoving(bound);
  return (
    <div className={`mx-cal-field${active ? " on" : ""}`}>
      <label>{label}</label>
      <div className="mx-cal-field-box">
        <input
          value={text}
          placeholder={placeholder}
          aria-label={label}
          onFocus={(event) => {
            onFocus();
            event.currentTarget.select();
          }}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onBlur={() => (text.trim() === shown ? undefined : onType(text))}
        />
        <button
          type="button"
          className={moving ? "on" : ""}
          disabled={!bound}
          title={moving ? "Moves with today — click to fix the date" : "A fixed date — click to make it move with today"}
          onClick={onToggle}
        >
          <MovingIcon />
        </button>
      </div>
      <i>{moving ? howSet(bound, end) : ""}</i>
    </div>
  );
}

/** Close on Escape and on a press outside the picker. */
function useDismiss(box: React.RefObject<HTMLDivElement | null>, close: () => void) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const press = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) close();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", press, true);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", press, true);
    };
  }, [box, close]);
}

/** Place the picker beside its anchor, inside the window; on a phone it is a sheet and needs no place. */
function usePlace(box: React.RefObject<HTMLDivElement | null>, anchor: Anchor, phone: boolean, side: "right" | "below") {
  useLayoutEffect(() => {
    const element = box.current;
    if (!element || phone) return;
    const at = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
    const margin = 10;
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const left = side === "right" ? at.right + margin : at.right - width;
    const top = side === "right" ? at.top : at.bottom + 8;
    element.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - width - margin))}px`;
    element.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
  });
}

/** Stop the wheel from reaching the canvas under the picker: it scrolls the picker, never the canvas (FR-005). */
function stopWheel(event: React.WheelEvent) {
  event.stopPropagation();
}

export function DateRangePicker({ options, onDone }: { options: RangePickerOptions; onDone: (range: Range | null) => void }) {
  const now = today();
  const min = lowest(options.min, now);
  const max = highest(options.max, now);
  const phone = isPhone();
  const shown = phone ? 1 : 2;
  const [draft, setDraft] = useState<Range>(options.value ?? { from: "", to: "" });
  const [active, setActive] = useState<"from" | "to">("from");
  const first = resolve(draft.from, false, now) || resolve(draft.to, true, now) || now;
  const [month, setMonth] = useState(() => viewMonth(addMonths(first.slice(0, 7), draft.from ? 0 : 1 - shown), min, max, shown));
  const [jump, setJump] = useState<{ from: string; offset: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, () => onDone(null));
  usePlace(box, options.anchor, phone, "right");

  const from = resolve(draft.from, false, now);
  const to = resolve(draft.to, true, now);
  const showEnd = (range: Range) => {
    const end = resolve(range.to, true, now) || resolve(range.from, false, now);
    if (end) setMonth(viewMonth(addMonths(end.slice(0, 7), 1 - shown), min, max, shown));
  };
  const move = (by: number) => setMonth((was) => viewMonth(addMonths(was, by), min, max, shown));
  const field = (which: "from" | "to") => (
    <Field
      label={which === "from" ? "From" : "To"}
      bound={draft[which]}
      end={which === "to"}
      active={active === which}
      now={now}
      placeholder={which === "from" ? "the start" : "the end"}
      onFocus={() => setActive(which)}
      onType={(text) => {
        const bound = parseTyped(text);
        if (bound === null) return setDraft({ ...draft });
        const next = typeBound(draft, which, bound, min, max, now);
        setDraft(next);
        const day = resolve(next[which], which === "to", now);
        if (day) setMonth(viewMonth(addMonths(day.slice(0, 7), which === "to" ? 1 - shown : 0), min, max, shown));
      }}
      onToggle={() => setDraft({ ...draft, [which]: toggleMoving(draft[which], which === "to", now) })}
    />
  );
  const pick = (day: string) => {
    const next = pickDay(draft, active, day, now);
    setDraft(next.range);
    setActive(next.active);
  };
  const months = jump ? (
    <Wheels
      month={jump.from}
      min={min}
      max={max}
      onStop={(next) => setJump({ ...jump, from: next })}
      onClose={() => {
        setMonth(viewMonth(addMonths(jump.from, -jump.offset), min, max, shown));
        setJump(null);
      }}
    />
  ) : (
    Array.from({ length: shown }, (_, index) => {
      const each = addMonths(month, index);
      return (
        <Month
          key={each}
          month={each}
          min={min}
          max={max}
          from={from}
          to={to}
          now={now}
          onPick={pick}
          onJump={() => setJump({ from: each, offset: index })}
          nav={index === shown - 1 ? <Nav month={month} min={min} max={max} shown={shown} onMove={move} /> : undefined}
        />
      );
    })
  );
  return (
    <div ref={box} className={`mx-cal${phone ? " sheet" : ""}`} role="dialog" aria-label="Choose dates" onWheel={stopWheel}>
      <Presets
        core={RANGE_PRESETS}
        own={options.presets ?? []}
        chosen={(preset) => draft.from === preset.from && draft.to === (preset.to ?? "")}
        onPick={(preset) => {
          const next = { from: preset.from, to: preset.to ?? "" };
          setDraft(next);
          showEnd(next);
        }}
      />
      <div className="mx-cal-main">
        <div className="mx-cal-fields">
          {field("from")}
          <span className="mx-cal-arrow">→</span>
          {field("to")}
        </div>
        <div className={`mx-cal-months${jump || shown === 1 ? " one" : ""}`}>{months}</div>
        <div className="mx-cal-foot">
          <span className="mx-cal-summary">{rangeSummary(draft, now)}</span>
          <button type="button" onClick={() => onDone(null)}>Cancel</button>
          <button type="button" className="apply" onClick={() => onDone(draft)}>Apply</button>
        </div>
      </div>
    </div>
  );
}

export function DatePicker({ options, onDone }: { options: DatePickerOptions; onDone: (bound: Bound | null) => void }) {
  const now = today();
  const min = lowest(options.min, now);
  const max = highest(options.max, now);
  const phone = isPhone();
  const [draft, setDraft] = useState<Bound>(options.value ?? "");
  const day = resolve(draft, false, now);
  const [month, setMonth] = useState(() => viewMonth((day || now).slice(0, 7), min, max, 1));
  const [jump, setJump] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, () => onDone(null));
  usePlace(box, options.anchor, phone, "below");
  return (
    <div ref={box} className={`mx-cal single${phone ? " sheet" : ""}`} role="dialog" aria-label="Choose a date" onWheel={stopWheel}>
      <Presets
        core={DATE_PRESETS}
        own={options.presets ?? []}
        chosen={(preset) => draft === preset.from}
        onPick={(preset) => {
          setDraft(preset.from);
          const at = resolve(preset.from, false, now);
          if (at) setMonth(viewMonth(at.slice(0, 7), min, max, 1));
        }}
      />
      <div className="mx-cal-main">
        <div className="mx-cal-fields">
          <Field
            label="Date"
            bound={draft}
            end={false}
            active
            now={now}
            placeholder="No date"
            onFocus={() => undefined}
            onType={(text) => {
              const bound = parseTyped(text);
              if (bound === null) return setDraft(draft);
              const next = typeBound({ from: bound, to: "" }, "from", bound, min, max, now).from;
              setDraft(next);
              const at = resolve(next, false, now);
              if (at) setMonth(viewMonth(at.slice(0, 7), min, max, 1));
            }}
            onToggle={() => setDraft(toggleMoving(draft, false, now))}
          />
        </div>
        <div className="mx-cal-months one">
          {jump ? (
            <Wheels month={jump} min={min} max={max} onStop={setJump} onClose={() => { setMonth(viewMonth(jump, min, max, 1)); setJump(null); }} />
          ) : (
            <Month
              month={month}
              min={min}
              max={max}
              from={day}
              to=""
              now={now}
              onPick={setDraft}
              onJump={() => setJump(month)}
              nav={<Nav month={month} min={min} max={max} shown={1} onMove={(by) => setMonth((was) => viewMonth(addMonths(was, by), min, max, 1))} />}
            />
          )}
        </div>
        <div className="mx-cal-foot">
          <span className="mx-cal-summary">{day ? weekdayLabel(day) : "No date"}</span>
          <button type="button" onClick={() => onDone(null)}>Cancel</button>
          <button type="button" className="apply" onClick={() => onDone(draft)}>Apply</button>
        </div>
      </div>
    </div>
  );
}

/** Mount one picker over the page until it gives its answer; the answer resolves the promise. */
function mount<Answer>(draw: (done: (answer: Answer | null) => void) => ReactNode): Promise<Answer | null> {
  return new Promise((resolveAnswer) => {
    const host = document.createElement("div");
    host.className = "mx-cal-host";
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (answer: Answer | null) => {
      root.unmount();
      host.remove();
      resolveAnswer(answer);
    };
    root.render(<>{isPhone() ? <div className="mx-cal-scrim" /> : null}{draw(done)}</>);
  });
}

/** Open the date range picker beside ``anchor``; resolves to the range as the address writes it, or null when closed. */
export function openDateRangePicker(options: RangePickerOptions): Promise<Range | null> {
  return mount<Range>((done) => <DateRangePicker options={options} onDone={done} />);
}

/** Open the date picker beside ``anchor``; resolves to the date as the address writes it, or null when closed. */
export function openDatePicker(options: DatePickerOptions): Promise<Bound | null> {
  return mount<Bound>((done) => <DatePicker options={options} onDone={done} />);
}
