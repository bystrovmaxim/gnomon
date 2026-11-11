// web/app/[org]/items/[item_id]/people.ts — how a writer is marked in the filters: their initials in a disk of one
// colour of Maxitor's palette, the same colour every time for the same person.
const COLOURS = ["blue", "amber", "teal", "violet", "green", "pink", "red"] as const;

/** Up to two initials of a name: "Olga Sidorova" → "OS", "anna" → "A". */
export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
}

/** A palette colour picked by the person's key, so a person keeps one colour on every page. */
export function paletteOf(key: string): string {
  let sum = 0;
  for (const char of key) sum = (sum * 31 + char.charCodeAt(0)) >>> 0;
  return COLOURS[sum % COLOURS.length];
}
