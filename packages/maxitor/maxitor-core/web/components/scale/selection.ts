/** The upper half selects A and the lower half B, independently of their horizontal positions. */
export function handleAt(y: number, top: number, base: number, comparing: boolean): "one" | "a" | "b" {
  return comparing ? (y < (top + base) / 2 ? "a" : "b") : "one";
}

/** Edge strips take priority over a nearby vertical line; the body still permits brushing or panning. */
export function grabbedHandle(x: number, y: number, top: number, base: number, a: number | null, b: number): "one" | "a" | "b" | null {
  const handle = handleAt(y, top, base, a !== null);
  if (a !== null && (y < top + 8.5 || y > base - 8.5)) return handle;
  const target = handle === "a" ? a! : b;
  return Math.abs(target - x) < 10 ? handle : null;
}

/** Move the whole interval without changing its duration or crossing the history's ends. */
export function intervalShift(shift: number, a: number, b: number, first: number, now: number): number {
  return Math.min(Math.max(shift, first - a), now - b);
}

/** The move affordance belongs only to the shaded body, never to the dates or the unselected time. */
export function overInterval(x: number, y: number, top: number, base: number, a: number, b: number): boolean {
  return a !== b && x >= Math.min(a, b) && x <= Math.max(a, b) && y >= top && y <= base;
}

/** Edge clicks retain A/B semantics; the plot chooses the horizontally nearest bound. */
export function nearestHandle(x: number, y: number, top: number, base: number, a: number | null, b: number): "one" | "a" | "b" {
  if (a === null) return "one";
  if (y < top + 8.5 || y > base - 8.5 || Math.abs(x-a) === Math.abs(x-b)) return handleAt(y,top,base,true);
  return Math.abs(x-a) < Math.abs(x-b) ? "a" : "b";
}

/** The original event path survives removal of a transient SVG target during pointerdown. */
export function insideScale(event: { composedPath(): EventTarget[] }, holder: EventTarget): boolean {
  return event.composedPath().includes(holder);
}
