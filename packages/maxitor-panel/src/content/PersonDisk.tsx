// @maxitor/panel — a person as every page draws them: a disk of their colour from Maxitor's palette with their initials,
// the same as in a table's person cell and an Authors filter, so one person looks alike on every card, row and filter.
import { PALETTE, paletteColour, type PaletteColour } from "@maxitor/tokens";

import { initials } from "./list";

/** A palette colour by name, grey for a name the palette does not hold. */
export function personColour(name: string | undefined): string {
  return paletteColour((PALETTE as readonly string[]).includes(name ?? "") ? (name as PaletteColour) : "grey");
}

/** The disk of a person: `colour` is a name of Maxitor's palette. */
export function PersonDisk({ name, colour }: { name: string; colour?: string }) {
  return (
    <span className="mx-disk" style={{ background: personColour(colour) }} title={name}>
      {initials(name)}
    </span>
  );
}
