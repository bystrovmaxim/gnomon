// packages/maxitor/maxitor-core/web/components/scale/Track.tsx
// The scale itself (spec 079, FR-002, FR-003, FR-012, FR-014), as the accepted mockup of spec 074 draws it, top to
// bottom: the milestones' lane — each point where it happened, from its kind —, the bars of the page's changes —
// added green, changed amber, removed red —, the time axis with its dates, and the moment's chip. "Now" is a green
// dashed line with nothing written on it; the future right of it is hatched. A click chooses a moment — on a point,
// that milestone —, a drag of the handle moves it; dragging across a stretch zooms into it, the wheel zooms round the
// pointer, Shift-wheel or a sideways swipe moves; on a phone a drag moves and two fingers pinch.
"use client";

import type { Bar, CardBlock, Milestone } from "@maxitor/panel/history";
import type { Kind } from "@maxitor/panel/protocol";
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { hatchFrom, moveView, ticksOf, timeAt, xOf, zoomView, type View } from "@/components/scale/geometry";
import { Flag, Point, POINT, SMALL_POINT, toneColour } from "@/components/scale/Point";
import { Tip } from "@/components/scale/Tip";
import { clockText, dayText, momentText, msOf } from "@/lib/moment";

/** The rows of the scale: the room over the body, the lane, the bars, the dates under the axis and the chip. */
const TOP = 22;
const LANE = 50;
const LANE_Y = TOP + 28;
const BARS = 86;
const EMPTY = 36;
const DATES = 13;
const CHIP = 30;
/** A handle answers the pointer this many pixels round it, a point this many; a shorter drag is a click. */
const NEAR = 10;
const NEAR_POINT = 8;
const CLICK = 6;
/** The time "now" is said for: within half a minute of the watermark. */
const NOW_SLACK = 30_000;

/** A handle of the scale: the one moment, or A and B of a comparison. */
export type Handle = "one" | "a" | "b";

type Drag =
  | { kind: "handle"; handle: Handle; time: number }
  | { kind: "brush"; x0: number; x1: number }
  | { kind: "pan"; x0: number; view: View; moved: boolean }
  | { kind: "pinch"; distance: number; view: View; centre: number };

export function Track({
  view,
  domain,
  width,
  now,
  shown,
  against,
  phone,
  bars,
  step,
  milestones,
  kinds,
  cardOf,
  onView,
  onChoose,
  onMilestone,
}: {
  view: View;
  domain: View;
  width: number;
  /** The watermark, in milliseconds. */
  now: number;
  /** The moment shown, in milliseconds: now, or the chosen one; B in a comparison. */
  shown: number;
  /** A of a comparison, in milliseconds; null at one moment. */
  against: number | null;
  phone: boolean;
  /** The bars of the stretch in view; null when the page has no bars. */
  bars: Bar[] | null;
  /** The width of a bar, in milliseconds. */
  step: number;
  /** The milestones the setup allows, small ones already left out when hidden; null when the page has none. */
  milestones: Milestone[] | null;
  kinds: Record<string, Kind>;
  /** A milestone's card: its blocks, null while it is read, undefined when the page has no card. */
  cardOf: (milestone: Milestone) => CardBlock[] | null | undefined;
  /** The stretch in view changed: `glide` asks the card to move there smoothly. */
  onView: (view: View, glide: boolean) => void;
  /** A handle was moved to this time — the one moment, or A or B —; the card decides whether it is now. */
  onChoose: (time: number, handle: Handle) => void;
  /** A milestone was chosen; in a comparison, for the handle nearer to it. */
  onMilestone: (milestone: Milestone, handle: Handle) => void;
}) {
  const hatch = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, number>());
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const X = (time: number) => xOf(time, view, width);
  const T = (x: number) => timeAt(x, view, width);

  const lane = milestones !== null;
  const barsTop = TOP + (lane ? LANE : 0);
  const base = barsTop + (bars !== null ? BARS : lane ? 0 : EMPTY);
  const height = base + DATES + CHIP;

  // The wheel zooms round the pointer, Shift-wheel and a sideways swipe move; the page itself never scrolls under it.
  const latest = useRef({ view, domain, width });
  latest.current = { view, domain, width };
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const { view: was, domain: whole, width: wide } = latest.current;
      const span = was.to - was.from;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) {
        onView(moveView(was, ((event.deltaX || event.deltaY) / wide) * span, whole), true);
        return;
      }
      const at = timeAt(localX(element, event.clientX), was, wide);
      onView(zoomView(was, at, Math.exp(event.deltaY * (event.ctrlKey ? 0.012 : 0.0022)), whole), true);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [onView]);

  const pointX = (milestone: Milestone) => X(msOf(milestone.at));
  const nearPoint = (x: number): Milestone | null => {
    let best: Milestone | null = null;
    let distance = NEAR_POINT;
    for (const milestone of milestones ?? []) {
      const d = Math.abs(pointX(milestone) - x);
      if (d < distance) {
        distance = d;
        best = milestone;
      }
    }
    return best;
  };

  // The handles where they stand, the one being dragged where the pointer is.
  const times: Partial<Record<Handle, number>> = against === null ? { one: shown } : { a: against, b: shown };
  if (drag?.kind === "handle") times[drag.handle] = drag.time;
  const nearHandle = (x: number): Handle | null => {
    let best: Handle | null = null;
    let distance = NEAR;
    for (const [handle, time] of Object.entries(times) as [Handle, number][]) {
      const d = Math.abs(X(time) - x);
      if (d < distance) {
        distance = d;
        best = handle;
      }
    }
    return best;
  };
  /** The handle a click at a time moves: the one moment, or the nearer of A and B. */
  const nearer = (time: number): Handle => (against === null ? "one" : Math.abs(time - against) < Math.abs(time - shown) ? "a" : "b");

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    const x = localX(event.currentTarget, event.clientX);
    pointers.current.set(event.pointerId, x);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      setDrag({ kind: "pinch", distance: Math.max(1, Math.abs(a - b)), view, centre: T((a + b) / 2) });
      return;
    }
    const grabbed = nearHandle(x);
    if (grabbed) setDrag({ kind: "handle", handle: grabbed, time: T(x) });
    else if (phone) setDrag({ kind: "pan", x0: x, view, moved: false });
    else setDrag({ kind: "brush", x0: x, x1: x });
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const x = localX(event.currentTarget, event.clientX);
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, x);
    if (!drag) {
      setHover({ x, y: localY(event.currentTarget, event.clientY) });
      return;
    }
    if (drag.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (b === undefined) return;
      onView(zoomView(drag.view, drag.centre, drag.distance / Math.max(1, Math.abs(a - b)), domain), false);
    } else if (drag.kind === "handle") setDrag({ ...drag, time: Math.min(Math.max(T(x), domain.from), now) });
    else if (drag.kind === "brush") setDrag({ ...drag, x1: x });
    else {
      const dx = x - drag.x0;
      const moved = drag.moved || Math.abs(dx) > 3;
      if (moved) onView(moveView(drag.view, (-dx / width) * (drag.view.to - drag.view.from), domain), false);
      if (moved !== drag.moved) setDrag({ ...drag, moved });
    }
  };
  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const was = drag;
    setDrag(null);
    if (!was || was.kind === "pinch") return;
    const x = localX(event.currentTarget, event.clientX);
    if (was.kind === "handle") return onChoose(was.time, was.handle);
    if (was.kind === "brush" && Math.abs(was.x1 - was.x0) > CLICK) return onView({ from: T(Math.min(was.x0, was.x1)), to: T(Math.max(was.x0, was.x1)) }, true);
    if (was.kind === "pan" && was.moved) return;
    const y = localY(event.currentTarget, event.clientY);
    const point = lane && y < barsTop ? nearPoint(x) : null;
    if (point) return onMilestone(point, nearer(msOf(point.at)));
    const time = T(x);
    if (time <= now) onChoose(time, nearer(time));
  };

  const nowX = X(now);
  const hatchX = hatchFrom(now, view, width);
  const ticks = ticksOf(view, width, (time) => {
    const date = new Date(time);
    return date.getHours() === 0 && date.getMinutes() === 0;
  });
  const label = (time: number) => (time >= now - NOW_SLACK ? "Now" : momentText(time, now));
  const brush = drag?.kind === "brush" ? { from: Math.min(drag.x0, drag.x1), to: Math.max(drag.x0, drag.x1) } : null;
  const inLane = hover !== null && lane && hover.y < barsTop;
  const hoveredPoint = hover && !drag && inLane ? nearPoint(hover.x) : null;

  // The bars: stacked from the axis up, the y scale fitted to the tallest bar in view, with two faint lines.
  const barWidth = X(view.from + step) - X(view.from);
  const gap = barWidth > 6 ? 1.5 : barWidth > 3 ? 0.75 : 0;
  const tallest = Math.max(1, ...(bars ?? []).map((bar) => bar.added + bar.changed + bar.removed));
  const Y = (value: number) => (value / tallest) * (BARS - 8);
  const hoveredBar = hover && !drag && !inLane && bars !== null && hover.y >= barsTop && hover.y <= base ? barAt(bars, T(hover.x), step) : null;

  return (
    <div
      ref={box}
      className={`mx-track${drag && drag.kind !== "brush" ? " grabbing" : ""}`}
      style={{ height }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={() => setHover(null)}
    >
      <svg width={width} height={height} className="mx-track-svg" aria-hidden>
        <defs>
          <pattern id={hatch} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={6} className="mx-track-hatch" />
          </pattern>
          <filter id={`${hatch}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx={0} dy={1} stdDeviation={1.2} floodOpacity={0.25} />
          </filter>
        </defs>
        {bars !== null
          ? [0.5, 1].map((share) => {
              const value = Math.round(tallest * share);
              if (!value) return null;
              const y = base - Y(value);
              return (
                <g key={share}>
                  <line x1={0} y1={y} x2={width} y2={y} className="mx-track-grid" />
                  <text x={2} y={y - 3} className="mx-track-count">{value}</text>
                </g>
              );
            })
          : null}
        {ticks.map((tick) => {
          const x = X(tick.time);
          return (
            <g key={tick.time}>
              <line x1={x} y1={barsTop} x2={x} y2={base} className={tick.day ? "mx-track-day" : "mx-track-hour"} />
              {x < 18 || x > width - 18 ? null : (
                <text x={x} y={base + DATES} className={`mx-track-date${tick.day ? " day" : ""}`} textAnchor="middle">
                  {tick.dated ? dayText(tick.time) : clockText(tick.time)}
                </text>
              )}
            </g>
          );
        })}
        {hatchX === null ? null : <rect x={hatchX} y={TOP} width={width - hatchX} height={base + 8 - TOP} fill={`url(#${hatch})`} />}
        {times.a !== undefined && times.b !== undefined ? (
          <rect
            x={Math.max(0, X(Math.min(times.a, times.b)))}
            y={TOP}
            width={Math.max(0, Math.min(width, X(Math.max(times.a, times.b))) - Math.max(0, X(Math.min(times.a, times.b))))}
            height={base + 8 - TOP}
            className="mx-track-range"
          />
        ) : null}
        {(bars ?? []).map((bar) => {
          const x = X(msOf(bar.start)) + gap / 2;
          const w = Math.max(1.2, barWidth - gap);
          const on = hoveredBar === bar;
          let y = base;
          return (
            <g key={bar.start} className={on ? "mx-bar-on" : "mx-bar"}>
              {(["added", "changed", "removed"] as const).map((part) => {
                if (!bar[part]) return null;
                const h = Y(bar[part]);
                y -= h;
                return <rect key={part} x={x} y={y} width={w} height={h} className={`mx-bar-${part}`} />;
              })}
            </g>
          );
        })}
        <line x1={0} y1={base} x2={width} y2={base} className="mx-track-axis" />
        {lane ? <line x1={0} y1={LANE_Y} x2={width} y2={LANE_Y} className="mx-lane" /> : null}
        {lane ? <Leads milestones={milestones} kinds={kinds} X={pointX} width={width} /> : null}
        {(milestones ?? []).map((milestone) => {
          const x = pointX(milestone);
          if (x < -2 || x > width + 2) return null;
          const kind = kinds[milestone.kind];
          const r = milestone.small ? SMALL_POINT : POINT;
          const on = hoveredPoint === milestone;
          return (
            <g key={milestone.id}>
              {milestone.flag ? <Flag x={x} y={LANE_Y} r={r} /> : null}
              <Point x={x} y={LANE_Y} r={r} kind={kind} />
              {on ? <circle cx={x} cy={LANE_Y} r={r + 3} className="mx-point-ring" /> : null}
              <text
                x={Math.min(Math.max(x, 10), width - 12)}
                y={LANE_Y + 17}
                className={`mx-point-ref${milestone.small ? " small" : ""}${on ? " on" : ""}`}
                style={on ? { fill: toneColour(kind.tone) } : undefined}
                textAnchor="middle"
              >
                {milestone.ref}
              </text>
            </g>
          );
        })}
        {nowX >= 0 && nowX <= width ? <line x1={nowX} y1={TOP} x2={nowX} y2={base} className="mx-track-now" /> : null}
        {hover && !drag && !inLane ? <line x1={hover.x} y1={TOP} x2={hover.x} y2={base} className="mx-track-hover" /> : null}
        {times.one !== undefined ? <HandleMark x={X(times.one)} width={width} top={TOP} base={base} chipY={base + DATES + CHIP - 13} text={label(times.one)} hollow={false} shadow={`${hatch}-shadow`} /> : null}
        {times.a !== undefined ? <HandleMark x={X(times.a)} width={width} top={TOP} base={base} chipY={TOP - 11} text={`A ${label(times.a)}`} hollow shadow={`${hatch}-shadow`} /> : null}
        {times.b !== undefined ? <HandleMark x={X(times.b)} width={width} top={TOP} base={base} chipY={base + DATES + CHIP - 13} text={`B ${label(times.b)}`} hollow={false} shadow={`${hatch}-shadow`} /> : null}
        {brush ? <rect x={brush.from} y={TOP} width={brush.to - brush.from} height={base - TOP} className="mx-track-brush" /> : null}
      </svg>
      {hoveredPoint ? (
        <div className="mx-track-tip card" style={{ left: Math.min(Math.max(pointX(hoveredPoint) - 160, 0), Math.max(0, width - 320)), top: height + 2 }}>
          <Tip
            blocks={cardOf(hoveredPoint) ?? [{ title: hoveredPoint.title }, { line: [{ ref: hoveredPoint.ref }, { ago: hoveredPoint.at }] }]}
            foot={hoveredPoint.opens ? "Click to open it; the moment does not change" : `Click to read the page at ${momentText(msOf(hoveredPoint.at), now)}`}
            now={now}
          />
        </div>
      ) : hover && !drag && !inLane ? (
        <div className="mx-track-tip" style={{ left: Math.min(Math.max(hover.x - 135, 0), Math.max(0, width - 270)), top: height + 2 }}>
          <BarTip time={T(hover.x)} now={now} bar={hoveredBar} step={step} bars={bars !== null} />
        </div>
      ) : null}
    </div>
  );
}

/** The line between two points, coloured as the later one, dashed when its kind leads with a dashed line. */
function Leads({ milestones, kinds, X, width }: { milestones: Milestone[]; kinds: Record<string, Kind>; X: (milestone: Milestone) => number; width: number }) {
  return (
    <>
      {milestones.slice(1).map((milestone, index) => {
        const from = X(milestones[index]);
        const to = X(milestone);
        if (to < -2 || from > width + 2) return null;
        const kind = kinds[milestone.kind];
        return (
          <line
            key={milestone.id}
            x1={Math.max(from, 0)}
            y1={LANE_Y}
            x2={Math.min(to, width)}
            y2={LANE_Y}
            style={{ stroke: toneColour(kind.tone) }}
            className={`mx-lane-lead${kind.lead === "dashed" ? " dashed" : ""}`}
          />
        );
      })}
    </>
  );
}

/** What a hovered bar holds, or the moment under the pointer. */
function BarTip({ time, now, bar, step, bars }: { time: number; now: number; bar: Bar | null; step: number; bars: boolean }) {
  if (time > now) {
    return (
      <>
        <b>{momentText(time, 0)}</b>
        <span>Later than now: it cannot be chosen yet.</span>
      </>
    );
  }
  const start = bar ? msOf(bar.start) : Math.floor(time / step) * step;
  return (
    <>
      <b>{bars ? `${momentText(start, now)} – ${momentText(Math.min(start + step, now), now)}` : momentText(time, now)}</b>
      {bars ? (
        bar ? (
          <span className="mx-track-tip-counts">
            {bar.added ? <span className="mx-count-added">{bar.added} added</span> : null}
            {bar.changed ? <span className="mx-count-changed">{bar.changed} changed</span> : null}
            {bar.removed ? <span className="mx-count-removed">{bar.removed} removed</span> : null}
          </span>
        ) : (
          <span>No changes</span>
        )
      ) : null}
      <span className="mx-track-tip-foot">Click to read the page at {momentText(time, now)}</span>
    </>
  );
}

/** The bar holding a time, if it has changes. */
function barAt(bars: Bar[], time: number, step: number): Bar | null {
  for (const bar of bars) {
    const start = msOf(bar.start);
    if (time >= start && time < start + step) return bar;
  }
  return null;
}

/** A moment's handle: a line through the body, a knob on the axis and a dark chip under the dates — A's hollow, its chip
    above —; a chip at the edge, pointing out, when the moment is outside the stretch in view. */
function HandleMark({ x, width, top, base, chipY, text, hollow, shadow }: { x: number; width: number; top: number; base: number; chipY: number; text: string; hollow: boolean; shadow: string }) {
  const out = x < 0 || x > width;
  const shown = out ? `${x < 0 ? "‹ " : ""}${text}${x > width ? " ›" : ""}` : text;
  const chipWidth = shown.length * 6.1 + 16;
  const cx = Math.min(Math.max(Math.min(Math.max(x, 0), width), chipWidth / 2), width - chipWidth / 2);
  return (
    <g>
      {out ? null : (
        <>
          <line x1={x} y1={top} x2={x} y2={base} className="mx-track-handle" />
          <circle cx={x} cy={base} r={5.5} className={`mx-track-knob${hollow ? " hollow" : ""}`} filter={`url(#${shadow})`} />
        </>
      )}
      <rect x={cx - chipWidth / 2} y={chipY - 9} width={chipWidth} height={18} rx={9} className={`mx-track-chip${hollow ? " hollow" : ""}`} />
      <text x={cx} y={chipY + 3.8} className={`mx-track-chip-text${hollow ? " hollow" : ""}`} textAnchor="middle">
        {shown}
      </text>
    </g>
  );
}

/** The x and the y of a pointer inside an element. */
function localX(element: HTMLElement, clientX: number): number {
  const rect = element.getBoundingClientRect();
  return ((clientX - rect.left) * element.clientWidth) / (rect.width || 1);
}
function localY(element: HTMLElement, clientY: number): number {
  const rect = element.getBoundingClientRect();
  return ((clientY - rect.top) * element.clientHeight) / (rect.height || 1);
}
