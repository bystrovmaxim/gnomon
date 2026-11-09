// src/lib/cardPlace.ts
/** Where a hover card stands: beside what it describes, never over it, inside the stage (spec 043). */

/** A rectangle in the window's pixels. */
export type Box = { left: number; top: number; right: number; bottom: number };

const CARD_WIDTH_PX = 300;
const GAP_PX = 8;
/** The room kept under a card's top edge; more of it scrolls inside the card. */
const CARD_ROOM_PX = 240;

/** The card's place in ``stage``'s pixels, beside ``beside`` and level with ``level``: on the right, else on the left, else under it. */
export function cardBeside(stage: Box, beside: Box, level: Box): { x: number; y: number } {
  const width = stage.right - stage.left;
  const height = stage.bottom - stage.top;
  const right = beside.right - stage.left + GAP_PX;
  const left = beside.left - stage.left - GAP_PX - CARD_WIDTH_PX;
  const fitsRight = right + CARD_WIDTH_PX <= width - GAP_PX;
  const y = Math.max(GAP_PX, Math.min(level.top - stage.top, height - CARD_ROOM_PX));
  if (fitsRight) return { x: right, y };
  if (left >= GAP_PX) return { x: left, y };
  return { x: Math.max(GAP_PX, Math.min(level.left - stage.left, width - CARD_WIDTH_PX - GAP_PX)), y: Math.max(GAP_PX, Math.min(level.bottom - stage.top + GAP_PX, height - CARD_ROOM_PX)) };
}

/** What a card stands beside: the whole element, the part to stand level with, and what it should leave in sight. */
export type CardAround = { beside: Box; level: Box; avoid: readonly Box[] };

function overlap(a: Box, b: Box): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high));
}

/**
 * The card's place in ``stage``'s pixels, once its size is known: right of what it describes, left, under or above, whichever
 * first fits and leaves ``avoid`` in sight; if none does, the fitting side that covers least. A card taller than the stage
 * scrolls inside, so it is placed by the height it shows. Where no side fits at all, the card goes where it covers least
 * of what it describes — never over it while anywhere else is open (spec 071).
 */
export function placeCard(stage: Box, size: { width: number; height: number }, { beside, level, avoid }: CardAround): { x: number; y: number } {
  const width = size.width;
  const height = Math.min(size.height, stage.bottom - stage.top - 2 * GAP_PX);
  const [minX, maxX] = [stage.left + GAP_PX, Math.max(stage.left + GAP_PX, stage.right - width - GAP_PX)];
  const [minY, maxY] = [stage.top + GAP_PX, Math.max(stage.top + GAP_PX, stage.bottom - height - GAP_PX)];
  const alongside = clamp(level.top, minY, maxY);
  const across = clamp(level.left, minX, maxX);
  const all = [
    { left: beside.right + GAP_PX, top: alongside },
    { left: beside.left - GAP_PX - width, top: alongside },
    { left: across, top: beside.bottom + GAP_PX },
    { left: across, top: beside.top - GAP_PX - height },
  ];
  const fits = (side: { left: number; top: number }) => side.left >= minX && side.left <= maxX && side.top >= minY && side.top <= maxY;
  const boxOf = (side: { left: number; top: number }) => ({ left: side.left, top: side.top, right: side.left + width, bottom: side.top + height });
  const covered = (side: { left: number; top: number }) => avoid.reduce((sum, each) => sum + overlap(boxOf(side), each), 0);
  const sides = all.filter(fits);
  if (sides.length === 0) {
    // Nowhere fits whole: each side pushed onto the stage, the one that covers least of the element itself, then of the rest.
    const pushed = all.map((side) => ({ left: clamp(side.left, minX, maxX), top: clamp(side.top, minY, maxY) }));
    const cost = (side: { left: number; top: number }) => overlap(boxOf(side), beside) * 1000 + covered(side);
    const best = pushed.reduce((one, other) => (cost(other) < cost(one) ? other : one));
    return { x: best.left - stage.left, y: best.top - stage.top };
  }
  let best = sides[0]!;
  let least = covered(best);
  for (const side of sides) {
    const area = covered(side);
    if (area < least) [best, least] = [side, area];
  }
  return { x: best.left - stage.left, y: best.top - stage.top };
}

/** How far apart a line is sampled on screen, and how much room each sample asks for. */
const LINE_SAMPLE_PX = 36;
const LINE_REACH_PX = 10;
const MOST_LINE_SAMPLES = 32;

/** A drawn line as small boxes along it, with the labels at its ends: a card should leave these in sight too. */
export function lineBoxes(edge: Element): Box[] {
  const labels = [...edge.querySelectorAll("text")].map((label) => label.getBoundingClientRect()).filter((box) => box.width > 0);
  const path = edge.querySelector("path");
  const toScreen = path?.getScreenCTM();
  if (!path || !toScreen) return labels;
  const length = path.getTotalLength();
  const samples = Math.min(MOST_LINE_SAMPLES, Math.ceil((length * toScreen.a) / LINE_SAMPLE_PX) + 1);
  const along = Array.from({ length: samples }, (_, index) => {
    const point = path.getPointAtLength((length * index) / Math.max(1, samples - 1)).matrixTransform(toScreen);
    return { left: point.x - LINE_REACH_PX, top: point.y - LINE_REACH_PX, right: point.x + LINE_REACH_PX, bottom: point.y + LINE_REACH_PX };
  });
  return [...along, ...labels];
}
