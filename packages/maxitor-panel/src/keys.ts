// @maxitor/panel — the scale's keys, the same in the core's frame and in a page.
// The scale's keys (spec 079, FR-005), from the graph viewer's lib/stepKeys.ts: Shift + ← → step the moment as the
// pill's arrows do; Shift + ↑ ↓ step a comparison's changes. Not while one types, nor on a handle of the scale, whose
// keys move that handle.

type StepKey = Pick<KeyboardEvent, "key" | "shiftKey" | "altKey" | "ctrlKey" | "metaKey" | "target">;

export type { StepKeyName } from "./protocol";

/** The step a press asks for between two keys, or null when it asks for none. */
function stepBetween(event: StepKey, back: string, on: string): -1 | 1 | null {
  if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.key !== back && event.key !== on) return null;
  const target = event.target as Element | null;
  if (target?.closest?.('input, textarea, select, [contenteditable="true"], [role="slider"]')) return null;
  return event.key === back ? -1 : 1;
}

/** The step of the moment a key press asks for, or null. */
export function stepOfKey(event: StepKey): -1 | 1 | null {
  return stepBetween(event, "ArrowLeft", "ArrowRight");
}

/** The step through a comparison's changes a key press asks for, or null. */
export function changeStepOfKey(event: StepKey): -1 | 1 | null {
  return stepBetween(event, "ArrowUp", "ArrowDown");
}
