// packages/maxitor/maxitor-core/web/lib/colors.ts
// An organization's colour, a colour of the palette of @maxitor/tokens chosen from its code, so it stays the same
// everywhere.
import { paletteColour, type PaletteColour } from "@maxitor/tokens";

const ORGANIZATION_COLOURS: PaletteColour[] = ["teal", "violet", "blue", "pink", "amber", "green", "red", "grey"];

export function colorOf(code: string): string {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return paletteColour(ORGANIZATION_COLOURS[h % ORGANIZATION_COLOURS.length]);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}
