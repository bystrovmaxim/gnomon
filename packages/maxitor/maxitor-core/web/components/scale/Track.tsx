// packages/maxitor/maxitor-core/web/components/scale/Track.tsx
// The scale itself (spec 079, FR-002, FR-003, FR-012), as the accepted mockup of spec 074 draws it: the time axis with
// its dates — a day's line stronger —, "now" a green dashed line with nothing written on it, the hatched future right
// of it, and the handle of the moment shown with its chip under the axis. A click chooses a moment, a drag of the
// handle moves it; dragging across a stretch zooms into it, the wheel zooms round the pointer, Shift-wheel or a sideways
// swipe moves; on a phone a drag moves. Right of now nothing can be chosen.
"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { hatchFrom, moveView, ticksOf, timeAt, xOf, zoomView, type View } from "@/components/scale/geometry";
import { clockText, dayText, momentText } from "@/lib/moment";

/** The rows of the scale, top to bottom: the room of a chip over the body, the body, the dates, the moment's chip. */
const TOP = 22;
const BODY = 36;
const DATES = 13;
const CHIP = 30;
/** A handle answers the pointer this many pixels round it; a drag shorter than this is a click. */
const NEAR = 10;
const CLICK = 6;
/** The time "now" is said for: within half a minute of the watermark. */
const NOW_SLACK = 30_000;

type Drag =
  | { kind: "handle"; time: number }
  | { kind: "brush"; x0: number; x1: number }
  | { kind: "pan"; x0: number; view: View; moved: boolean };

export function Track({
  view,
  domain,
  width,
  now,
  shown,
  phone,
  onView,
  onChoose,
}: {
  view: View;
  domain: View;
  width: number;
  /** The watermark, in milliseconds. */
  now: number;
  /** The moment shown, in milliseconds: now, or the chosen one. */
  shown: number;
  phone: boolean;
  /** The stretch in view changed: `glide` asks the card to move there smoothly. */
  onView: (view: View, glide: boolean) => void;
  /** A moment was chosen at this time; the card decides whether it is now. */
  onChoose: (time: number) => void;
}) {
  const hatch = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const X = (time: number) => xOf(time, view, width);
  const T = (x: number) => timeAt(x, view, width);
  const base = TOP + BODY;
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

  const handleTime = drag?.kind === "handle" ? drag.time : shown;
  const nearHandle = (x: number) => Math.abs(X(handleTime) - x) < NEAR;

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    const x = localX(event.currentTarget, event.clientX);
    if (nearHandle(x)) setDrag({ kind: "handle", time: T(x) });
    else if (phone) setDrag({ kind: "pan", x0: x, view, moved: false });
    else setDrag({ kind: "brush", x0: x, x1: x });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const x = localX(event.currentTarget, event.clientX);
    if (!drag) {
      setHover(x);
      return;
    }
    if (drag.kind === "handle") setDrag({ kind: "handle", time: Math.min(Math.max(T(x), domain.from), now) });
    else if (drag.kind === "brush") setDrag({ ...drag, x1: x });
    else {
      const dx = x - drag.x0;
      const moved = drag.moved || Math.abs(dx) > 3;
      if (moved) onView(moveView(drag.view, (-dx / width) * (drag.view.to - drag.view.from), domain), false);
      if (moved !== drag.moved) setDrag({ ...drag, moved });
    }
  };
  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    const was = drag;
    setDrag(null);
    if (!was) return;
    const x = localX(event.currentTarget, event.clientX);
    if (was.kind === "handle") return onChoose(was.time);
    if (was.kind === "brush" && Math.abs(was.x1 - was.x0) > CLICK) return onView({ from: T(Math.min(was.x0, was.x1)), to: T(Math.max(was.x0, was.x1)) }, true);
    if (was.kind === "pan" && was.moved) return;
    const time = T(x);
    if (time <= now) onChoose(time);
  };

  const nowX = X(now);
  const hatchX = hatchFrom(now, view, width);
  const ticks = ticksOf(view, width, (time) => {
    const date = new Date(time);
    return date.getHours() === 0 && date.getMinutes() === 0;
  });
  const label = (time: number) => (time >= now - NOW_SLACK ? "Now" : momentText(time, now));
  const brush = drag?.kind === "brush" ? { from: Math.min(drag.x0, drag.x1), to: Math.max(drag.x0, drag.x1) } : null;
  const hoverTime = hover === null || drag ? null : T(hover);

  return (
    <div
      ref={box}
      className={`mx-track${drag && drag.kind !== "brush" ? " grabbing" : ""}`}
      style={{ height }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={() => setHover(null)}
    >
      <svg width={width} height={height} className="mx-track-svg" aria-hidden>
        <defs>
          <pattern id={hatch} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={6} className="mx-track-hatch" />
          </pattern>
        </defs>
        {ticks.map((tick) => {
          const x = X(tick.time);
          return (
            <g key={tick.time}>
              <line x1={x} y1={TOP} x2={x} y2={base} className={tick.day ? "mx-track-day" : "mx-track-hour"} />
              {x < 18 || x > width - 18 ? null : (
                <text x={x} y={base + DATES} className={`mx-track-date${tick.day ? " day" : ""}`} textAnchor="middle">
                  {tick.dated ? dayText(tick.time) : clockText(tick.time)}
                </text>
              )}
            </g>
          );
        })}
        {hatchX === null ? null : <rect x={hatchX} y={TOP} width={width - hatchX} height={base + 8 - TOP} fill={`url(#${hatch})`} />}
        <line x1={0} y1={base} x2={width} y2={base} className="mx-track-axis" />
        {nowX >= 0 && nowX <= width ? <line x1={nowX} y1={TOP} x2={nowX} y2={base} className="mx-track-now" /> : null}
        {hoverTime !== null && hover !== null ? <line x1={hover} y1={TOP} x2={hover} y2={base} className="mx-track-hover" /> : null}
        <Handle x={X(handleTime)} width={width} top={TOP} base={base} chipY={base + DATES + CHIP - 12} text={label(handleTime)} />
        {brush ? <rect x={brush.from} y={TOP} width={brush.to - brush.from} height={base - TOP} className="mx-track-brush" /> : null}
      </svg>
      {hoverTime !== null && hover !== null ? (
        <div className="mx-track-tip" style={{ left: Math.min(Math.max(hover - 135, 0), Math.max(0, width - 270)), top: height + 2 }}>
          <b>{momentText(hoverTime, now)}</b>
          <span>{hoverTime > now ? "Later than now: it cannot be chosen yet." : `Click to read the page at ${momentText(hoverTime, now)}`}</span>
        </div>
      ) : null}
    </div>
  );
}

/** The moment's handle: a line through the body, a knob on the axis and a dark chip under the dates; a chip at the
    edge, pointing out, when the moment is outside the stretch in view. */
function Handle({ x, width, top, base, chipY, text }: { x: number; width: number; top: number; base: number; chipY: number; text: string }) {
  const out = x < 0 || x > width;
  const shown = out ? `${x < 0 ? "‹ " : ""}${text}${x > width ? " ›" : ""}` : text;
  const chipWidth = shown.length * 6.1 + 16;
  const cx = Math.min(Math.max(Math.min(Math.max(x, 0), width), chipWidth / 2), width - chipWidth / 2);
  return (
    <g>
      {out ? null : (
        <>
          <line x1={x} y1={top} x2={x} y2={base} className="mx-track-handle" />
          <circle cx={x} cy={base} r={5.5} className="mx-track-knob" />
        </>
      )}
      <rect x={cx - chipWidth / 2} y={chipY - 9} width={chipWidth} height={18} rx={9} className="mx-track-chip" />
      <text x={cx} y={chipY + 3.8} className="mx-track-chip-text" textAnchor="middle">
        {shown}
      </text>
    </g>
  );
}

/** The x of a pointer inside an element. */
function localX(element: HTMLElement, clientX: number): number {
  const rect = element.getBoundingClientRect();
  return ((clientX - rect.left) * element.clientWidth) / (rect.width || 1);
}
