// @maxitor/panel — the shell's icon set (spec 078, FR-005): every item of the bottom bar, every layer pill and every
// page action draws one of these, so a plugin's buttons look like every other plugin's. The glyphs are maxitor-web's.
import type { ReactNode } from "react";

const GLYPHS = {
  cards: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  table: <path d="M3.5 5h17v14h-17zM3.5 9.5h17M3.5 14h17M9 9.5V19" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  "layout-lr": <path d="M3 7h5v10H3zM16 4h5v6h-5zM16 14h5v6h-5zM8 12h4M12 7v10M12 7h4M12 17h4" />,
  "layout-tb": <path d="M7 3h10v5H7zM4 16h6v5H4zM14 16h6v5h-6zM12 8v4M7 12h10M7 12v4M17 12v4" />,
  "close-ports": <path d="M4 12h16M8 3l4 4 4-4M8 21l4-4 4 4" />,
  "hover-cards": <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  domain: <circle cx="12" cy="12" r="7" />,
  event: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  action: <path d="M5 4l14 8-14 8z" />,
  note: <path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5" />,
  dot: <circle cx="12" cy="12" r="2.5" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof GLYPHS;

/** Whether the set has an icon of this name. */
export function hasIcon(name: string): name is IconName {
  return Object.hasOwn(GLYPHS, name);
}

/** An icon of the set; an unknown name draws the neutral dot and, in development, says which name it was. */
export function Icon({ name }: { name: string }) {
  if (!hasIcon(name) && process.env.NODE_ENV !== "production") {
    console.error(`@maxitor/panel: the shell has no icon ${JSON.stringify(name)}; it draws the neutral dot`);
  }
  return (
    <svg className="mx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {GLYPHS[hasIcon(name) ? name : "dot"]}
    </svg>
  );
}
