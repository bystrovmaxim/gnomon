// @maxitor/tokens — the names code needs; the values themselves live in tokens.css.

/** The colours of the palette a plugin may name in navigation.yaml, as the navigation schema lists them. */
export const PALETTE = ["grey", "blue", "green", "amber", "red", "violet", "teal", "pink"] as const;

export type PaletteColour = (typeof PALETTE)[number];

/** The CSS value of a palette colour, for a style written in code. */
export function paletteColour(name: PaletteColour): string {
  return `var(--mx-palette-${name})`;
}

/** The phone's width: below it the tree is a drawer and the controls fold. Equal to --mx-phone in tokens.css. */
export const PHONE_MEDIA = "(max-width: 520px)";
