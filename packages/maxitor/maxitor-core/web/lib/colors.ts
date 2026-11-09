// packages/maxitor/maxitor-core/web/lib/colors.ts
// An organization's colour, chosen from its code so it stays the same everywhere.
const PALETTE = ["#0d9488", "#7c3aed", "#2563eb", "#db2777", "#ea580c", "#0891b2", "#65a30d", "#9333ea"];

export function colorOf(code: string): string {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}
