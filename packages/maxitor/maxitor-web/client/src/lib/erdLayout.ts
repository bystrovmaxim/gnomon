// src/lib/erdLayout.ts
/**
 * The ERD's picture made from its data (#85): the DOT, the layout by Graphviz — Dot's clusters, or the composer for
 * Neato, FDP and Circo — and the post-pass that draws the cards, the frames' disks and the kind glyphs. Everything is
 * text, so it runs in a Web Worker (``erdLayout.worker.ts``) and the page stays live while a large model is laid out.
 *
 * The picture is made with stand-ins for the paint's colours (``withPaintStandIns``): one layout and one markup serve
 * every paint, both are kept, and a repaint only gives the stand-ins their colours.
 */
import type { Engine, Graphviz } from "@hpcc-js/wasm-graphviz";
import {
  buildErdDot,
  ERD_CARD_RADIUS,
  ERD_CARD_STROKE,
  erdDiffMarks,
  erdGraphvizEngine,
  paintEveryFrame,
  recolour,
  setErdPaint,
  withPaintStandIns as withStandIns,
  type ErdGraphPayload,
  type ErdGraphvizLayout,
  type ErdPaintSource,
} from "./buildDotSource.ts";
import { containNodeFills } from "./containNodeFills.ts";
import { erdCompose } from "./erdCompose.ts";
import { addFrameIcons, drawErdCards, paintKindIcons, placeKindIcons } from "./erdPostPass.ts";
import { kindGlyphSvg } from "./icons/entity_kind_glyphs.ts";

/** What a picture is made from: the tables as drawn, the layout mode and the paint. */
export type ErdLayoutRequest = {
  data: ErdGraphPayload;
  layout: ErdGraphvizLayout;
  paint: { source: ErdPaintSource; colours: Readonly<Record<string, string>> };
};

/** A picture: Graphviz's own SVG in the paint's colours, the markup for the page with stand-ins, and their colours. */
export type ErdLayoutResult = {
  rawSvg: string;
  markup: string;
  colours: ReadonlyMap<string, string>;
  /** The slot each stand-in of ``markup`` stands for, so the page can repaint it from ``erdPaintColours``. */
  slots: ReadonlyMap<string, string>;
};

/** The two Graphviz instances a picture is made with: the shared one, and FDP's own. */
export type ErdGraphvizFor = (engine: string) => Promise<Graphviz>;

const LAYOUT_CACHE = new Map<string, string>();
const MARKUP_CACHE = new Map<string, string>();
const CACHE_MAX = 24;

function keep(cache: Map<string, string>, key: string, value: string): void {
  cache.set(key, value);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

/** The picture of ``request``, each layout and markup kept for the next request that asks for it again. */
/** ``build`` with the paint's colours as they are: what ``withPaintStandIns`` gives, without a stand-in. */
function inRealColours<T>(build: () => T): { value: T; colours: ReadonlyMap<string, string>; slots: ReadonlyMap<string, string> } {
  return { value: build(), colours: new Map(), slots: new Map() };
}

export async function layOutErd(request: ErdLayoutRequest, graphvizFor: ErdGraphvizFor): Promise<ErdLayoutResult> {
  const { data, layout, paint } = request;
  const engine = erdGraphvizEngine(layout) as Engine;
  const isDot = layout === "gv-dot-lr" || layout === "gv-dot-tb";
  // FDP in this WebAssembly build lays some models out two ways when their colours are stand-ins, and one way in the
  // paint's own colours: its picture is made in those, so a repaint under FDP lays the model out again.
  const withPaintStandIns = engine === "fdp" ? inRealColours : withStandIns;
  const measurer = await graphvizFor("dot");
  setErdPaint(paint.source, paint.colours);
  // Every table of a specialization block as wide as its widest table (spec 029): measured first, on the shared
  // instance. FDP depends on what ran before it in an instance, so the drawing itself is that instance's first layout.
  const { value: source, colours, slots } = withPaintStandIns(() => {
    paintEveryFrame(data);
    return buildErdDot(data, layout, (measureDot) => measurer.layout(measureDot, "svg", "dot"));
  });
  const layoutKey = `${layout}\n${data.model ?? "plain"}\n${source}`;
  let laidOut = LAYOUT_CACHE.get(layoutKey);
  if (laidOut === undefined) {
    const gv = await graphvizFor(engine);
    // Dot draws frames as clusters; Neato, FDP and Circo go through the composer (research R2). With the logical
    // view's frames off there is no frame, so those three lay the tables out plain (spec 071).
    laidOut = withPaintStandIns(() =>
      isDot
        ? gv.layout(source, "svg", engine)
        : data.model
          ? erdCompose(data, layout, (dot, eng) => gv.layout(dot, "svg", eng as Engine))
          : gv.layout(source, "svg", engine),
    ).value;
    keep(LAYOUT_CACHE, layoutKey, laidOut);
  }
  const entities = data.entities ?? [];
  const marks = erdDiffMarks(entities);
  const markupKey = `${layoutKey}\n${JSON.stringify([[...marks.faded], [...marks.dashed], [...(marks.halo ?? [])]])}`;
  const madeBefore = MARKUP_CACHE.get(markupKey);
  // The renderer paints a card's band and row tints as rectangles inside a rounded outline; the post-pass trims every
  // fill to the contour, draws the frames' disks and puts each kind's glyph in its header.
  const { value: markup, colours: inks, slots: inkSlots } = withPaintStandIns(() => {
    paintKindIcons(entities);
    return madeBefore ?? placeKindIcons(drawErdCards(containNodeFills(addFrameIcons(laidOut)), ERD_CARD_RADIUS, ERD_CARD_STROKE, marks), entities, kindGlyphSvg, data.folds);
  });
  if (madeBefore === undefined) keep(MARKUP_CACHE, markupKey, markup);
  const all = new Map([...colours, ...inks]);
  return { rawSvg: recolour(laidOut, colours), markup, colours: all, slots: new Map([...slots, ...inkSlots]) };
}
