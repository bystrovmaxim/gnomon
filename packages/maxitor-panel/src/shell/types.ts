// @maxitor/panel — what a page gives its shell (spec 078, data model). What a server page gives is plain data;
// only a button, a switch and an action carry a function, and so come from a client component.

/** One row of a filter section: a colour disk of the palette and a label. */
export type FilterRow = {
  key: string;
  label: string;
  /** A palette name of @maxitor/tokens; grey when absent. */
  colour?: string;
  /** The row is in the page's choice but not in its data now: drawn faint. */
  absent?: boolean;
};

/** A section of the filters at the top left: its parameter lists the rows switched on. */
export type FilterSection = {
  title: string;
  param: string;
  rows: FilterRow[];
  /** The section can paint the drawing; with two such sections the paint switch shows. */
  paints?: boolean;
};

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
