// @maxitor/panel — the panel protocol (the plugin concept, 7.6; specs/077-core-frame/contracts/panel-protocol.md).
// The core and a plugin's page in the right panel talk only by these messages. Each side accepts a message from its
// own origin and the expected window only, and drops one whose shape it does not know.

export type Query = Record<string, string>;

/** From the page to the core. */
export type PageMessage =
  /** `shell`: the page renders the shell of @maxitor/panel, `shellVersion` its version (spec 078, FR-020). */
  | { type: "panel.ready"; build: string; surface: "document" | "canvas"; shell: boolean; shellVersion: string }
  | { type: "panel.navigate"; path: string; query: Query; mode: "push" | "replace" }
  | { type: "panel.title"; text: string }
  | { type: "panel.open"; owner: string; path: string; query: Query };

/** From the core to the page. */
export type CoreMessage =
  | { type: "panel.location"; path: string; query: Query; at: string | null }
  | { type: "panel.watermark"; at: string };

const text = (value: unknown): value is string => typeof value === "string";
const path = (value: unknown): value is string => text(value) && value.startsWith("/") && !value.startsWith("//");
const query = (value: unknown): value is Query =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every(text);

/** The message, when it is a page's message of a known shape; null otherwise. */
export function pageMessage(data: unknown): PageMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  switch (m.type) {
    case "panel.ready":
      // A page built before the shell sends neither field: it is a page without the shell.
      if (!text(m.build) || (m.surface !== "document" && m.surface !== "canvas")) return null;
      if ((m.shell !== undefined && typeof m.shell !== "boolean") || (m.shellVersion !== undefined && !text(m.shellVersion))) return null;
      return { type: m.type, build: m.build, surface: m.surface, shell: m.shell === true, shellVersion: text(m.shellVersion) ? m.shellVersion : "" };
    case "panel.navigate":
      return path(m.path) && query(m.query) && (m.mode === "push" || m.mode === "replace") ? { type: m.type, path: m.path, query: m.query, mode: m.mode } : null;
    case "panel.title":
      return text(m.text) ? { type: m.type, text: m.text.slice(0, 200) } : null;
    case "panel.open":
      return text(m.owner) && path(m.path) && query(m.query) ? { type: m.type, owner: m.owner, path: m.path, query: m.query } : null;
    default:
      return null;
  }
}

/** The message, when it is the core's message of a known shape; null otherwise. */
export function coreMessage(data: unknown): CoreMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  switch (m.type) {
    case "panel.location":
      return path(m.path) && query(m.query) && (m.at === null || text(m.at)) ? { type: m.type, path: m.path, query: m.query, at: m.at } : null;
    case "panel.watermark":
      return text(m.at) ? { type: m.type, at: m.at } : null;
    default:
      return null;
  }
}

/** Whether a message event comes from this origin and from the expected window. */
export function trusted(event: MessageEvent, expected: Window | null | undefined): boolean {
  return expected !== null && expected !== undefined && event.origin === window.location.origin && event.source === expected;
}
