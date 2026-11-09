// src/lib/relationGlyphs.ts
/**
 * The marks of a relation as its card shows them (spec 071): the end of a line in the ERD's own notation — the bars,
 * the circle and the crow's foot the drawing puts where a line meets a table — and a mark for the kind of relation.
 * Each is a small SVG as a ``data:`` URL, drawn left to right: the table the end stands for is on the right.
 */

/** How many of a table one end of a relation stands for, in words. */
export const RELATION_END_WORDS: Readonly<Record<string, string>> = {
  one: "exactly one",
  zero_one: "zero or one",
  one_many: "one or more",
  zero_many: "zero or more",
};

/** The same count as the drawing's notation reads it. */
export const RELATION_END_COUNT: Readonly<Record<string, string>> = { one: "1", zero_one: "0..1", one_many: "1..*", zero_many: "0..*" };

const INK = "#475569";
const END_WIDTH = 26;
const END_HEIGHT = 14;

function dataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * The end of a line as the ERD draws it for ``cardinality``, with the table at the right: ``one`` two bars, ``zero_one``
 * a circle and a bar, ``one_many`` a bar and a crow's foot, ``zero_many`` a circle and a crow's foot.
 */
export function relationEndGlyph(cardinality: string | null | undefined): string {
  const y = END_HEIGHT / 2;
  const bar = (x: number) => `<path d="M${x} 2.5V11.5"/>`;
  const circle = (x: number) => `<circle cx="${x}" cy="${y}" r="3" fill="#ffffff"/>`;
  const crow = `<path d="M17 ${y}L${END_WIDTH - 1} 2M17 ${y}L${END_WIDTH - 1} ${END_HEIGHT - 2}"/>`;
  const marks: Record<string, string> = {
    one: bar(16) + bar(20),
    zero_one: circle(14) + bar(20),
    one_many: bar(13) + crow,
    zero_many: circle(12) + crow,
  };
  const end = marks[cardinality ?? ""] ?? marks.zero_many!;
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${END_WIDTH}" height="${END_HEIGHT}" viewBox="0 0 ${END_WIDTH} ${END_HEIGHT}">` +
      `<g fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M1 ${y}H${END_WIDTH - 1}"/>${end}<path d="M${END_WIDTH - 0.7} 1V${END_HEIGHT - 1}" stroke-width="1.4"/></g></svg>`,
  );
}

/** The mark of a kind of relation: a plain line, a filled or a hollow diamond, or a dashed line to a hollow triangle. */
export function relationKindGlyph(kind: string | null | undefined): string {
  const marks: Record<string, string> = {
    association: `<path d="M2 8H14"/>`,
    composition: `<path d="M1.5 8H6"/><path d="M6 8L10 5L14 8L10 11Z" fill="${INK}"/>`,
    aggregation: `<path d="M1.5 8H6"/><path d="M6 8L10 5L14 8L10 11Z" fill="#ffffff"/>`,
    generalization: `<path d="M1.5 8H9" stroke-dasharray="2 1.6"/><path d="M9 4.5L14.5 8L9 11.5Z" fill="#ffffff"/>`,
  };
  const mark = marks[kind ?? "association"] ?? marks.association!;
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">` +
      `<g fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${mark}</g></svg>`,
  );
}

/**
 * ``text`` cut into the pieces between which a long name may break: before each capital that follows a lowercase
 * letter or a digit, and after a dot or an underscore — so ``MsgOutboxEntity.outbox_row`` breaks between its words,
 * never inside one.
 */
export function wordPieces(text: string): string[] {
  return text.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[._])/);
}
