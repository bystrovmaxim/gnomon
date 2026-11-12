// @maxitor/panel — what a page gives its shell (spec 078, data model). What a server page gives is plain data;
// only a button, a switch and an action carry a function, and so come from a client component.
import type { Preset } from "../pickers/dates";

/** One row of a filter section: a colour disk of the palette and a label. */
export type FilterRow = {
  key: string;
  label: string;
  /** A palette name of @maxitor/tokens; grey when absent. */
  colour?: string;
  /** A short mark inside the disk — a person's initials; the disk is plain without it. */
  mark?: string;
  /** The row is in the page's choice but not in its data now: drawn faint. */
  absent?: boolean;
};

/**
 * A choice of values: its parameter lists the rows switched on, and is absent when all are. A choice of one row is
 * a filter that is on or off. Rows come in the order the page gives — the values that hold the most rows first —
 * and a choice of more than eight shows a search, the first eight and "N more" (spec 081, FR-007, FR-008).
 */
export type ChoiceFilter = {
  kind?: "choice";
  title: string;
  param: string;
  rows: FilterRow[];
  /** The section can paint the drawing; with two such sections the paint switch shows. */
  paints?: boolean;
  /** The words of the search of a long choice: "Find a manager". */
  search?: string;
};

/** A text: one row with a magnifier, its parameter holding what is typed (spec 081, FR-009). */
export type TextFilter = {
  kind: "text";
  title: string;
  param: string;
  /** The page's words for what is searched: "Account or email". */
  placeholder: string;
};

/**
 * A range: two rows, From and To. Its parameter holds the bounds as written, `from..to`, either side empty: numbers
 * typed in the rows, or dates chosen in the date range picker — a day, a month, or a bound moving with today
 * (spec 081, FR-010, FR-011). A range of dates is named by its column, never "Time".
 */
export type RangeFilter = {
  kind: "range";
  title: string;
  param: string;
  unit: "number" | "date";
  /** For dates: the first and the last day or month a choice may take. */
  min?: string;
  max?: string;
  /** For dates: the page's own ready stretches, under the core's. */
  presets?: Preset[];
};

/** A section of the filters at the top left. */
export type FilterSection = ChoiceFilter | TextFilter | RangeFilter;

/** One layer pill: what the screen starts from, with its count. */
export type LayerOption = { value: string; label: string; icon: string; count?: number };

export type Layers = { default: string; options: LayerOption[] };

/** A choice of one in the bottom bar: a view, a layout. The shell writes its parameter. */
export type ChoiceSection = {
  kind: "choice";
  param: string;
  default: string;
  options: { value: string; title: string; icon: string }[];
};

/** Buttons in the bottom bar, each doing something on the page. */
export type ButtonSection = {
  kind: "button";
  items: { title: string; icon: string; onClick: () => void; disabled?: boolean }[];
};

/** A switch in the bottom bar: on or off, held by the page. */
export type SwitchSection = { kind: "switch"; title: string; icon: string; on: boolean; onChange: (on: boolean) => void };

export type BarSection = ChoiceSection | ButtonSection | SwitchSection;

/** A button of the page at the top right, shown only at now. */
export type PageAction = { title: string; icon?: string; onClick: () => void };
