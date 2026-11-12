// @maxitor/panel — the panel protocol (the plugin concept, 7.6; specs/077-core-frame/contracts/panel-protocol.md).
// The core and a plugin's page in the right panel talk only by these messages. Each side accepts a message from its
// own origin and the expected window only, and drops one whose shape it does not know.

export type Query = Record<string, string>;

/** The arrows a page passes to the core with panel.keys, Shift held. */
export const STEP_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const;
export type StepKeyName = (typeof STEP_KEYS)[number];

/** From the page to the core. */
export type PageMessage =
  /** `shell`: the page renders the shell of @maxitor/panel, `shellVersion` its version (spec 078, FR-020). */
  | { type: "panel.ready"; build: string; shell: boolean; shellVersion: string }
  /** How the page answers the core's time scale, given when it opens and whenever it gives a new one (spec 082). */
  | { type: "panel.history"; history: PageHistory }
  | { type: "panel.navigate"; path: string; query: Query; mode: "push" | "replace" }
  | { type: "panel.title"; text: string }
  | { type: "panel.open"; owner: string; path: string; query: Query }
  /** The anchors of what the page holds but its filters leave out now (spec 081, FR-013). */
  | { type: "panel.hidden"; anchors: string[] }
  /** Shift and an arrow pressed in the page: the core steps the moment (← →) or a comparison's changes (↑ ↓) (spec 079, FR-005). */
  | { type: "panel.keys"; key: StepKeyName };

/** From the core to the page. */
export type CoreMessage =
  | { type: "panel.location"; path: string; query: Query; at: string | null }
  | { type: "panel.watermark"; at: string };

const text = (value: unknown): value is string => typeof value === "string";
const path = (value: unknown): value is string => text(value) && value.startsWith("/") && !value.startsWith("//");
/** The most anchors one message may carry: a list of 10,000 rows and its other marks. */
export const MAX_HIDDEN = 20_000;
const anchors = (value: unknown): value is string[] => Array.isArray(value) && value.length <= MAX_HIDDEN && value.every(text);
const query = (value: unknown): value is Query =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every(text);

/** The message, when it is a page's message of a known shape; null otherwise. */
export function pageMessage(data: unknown): PageMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  switch (m.type) {
    case "panel.ready":
      // A page built before the shell sends neither field: it is a page without the shell.
      if (!text(m.build)) return null;
      if ((m.shell !== undefined && typeof m.shell !== "boolean") || (m.shellVersion !== undefined && !text(m.shellVersion))) return null;
      return { type: m.type, build: m.build, shell: m.shell === true, shellVersion: text(m.shellVersion) ? m.shellVersion : "" };
    case "panel.history": {
      const history = historyOf(m.history);
      return history ? { type: m.type, history } : null;
    }
    case "panel.navigate":
      return path(m.path) && query(m.query) && (m.mode === "push" || m.mode === "replace") ? { type: m.type, path: m.path, query: m.query, mode: m.mode } : null;
    case "panel.title":
      return text(m.text) ? { type: m.type, text: m.text.slice(0, 200) } : null;
    case "panel.open":
      return text(m.owner) && path(m.path) && query(m.query) ? { type: m.type, owner: m.owner, path: m.path, query: m.query } : null;
    case "panel.hidden":
      return anchors(m.anchors) ? { type: m.type, anchors: m.anchors } : null;
    case "panel.keys":
      return (STEP_KEYS as readonly unknown[]).includes(m.key) ? { type: m.type, key: m.key as StepKeyName } : null;
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

// ── a page's history (spec 082, FR-001 – FR-005; spec 079, history format 2): how a page sets up the core's time
// scale, given by the page in its code, never declared in navigation.yaml; the shape a message may carry, and the
// core's check of every name and every promise.

/** The comparisons a page may offer beside one moment. */
export const COMPARISONS = ["diff", "side_by_side"] as const;
export type Comparison = (typeof COMPARISONS)[number];

/** The core's palette of points, the looks of a point and the lines leading to it. */
export const TONES = ["neutral", "purple", "blue", "green", "amber", "red"] as const;
export const LOOKS = ["filled", "hollow", "dashed"] as const;
export const LEADS = ["solid", "dashed"] as const;
export type Tone = (typeof TONES)[number];
export type Look = (typeof LOOKS)[number];
export type Lead = (typeof LEADS)[number];

/** One kind of the page's points: how its point is drawn and what the legend says of it. */
export type Kind = { tone: Tone; look: Look; lead: Lead; term: string; def: string };

/** An action a page offers on a milestone of its kinds, called exactly on it: Roll back to {ref}. */
export type MilestoneAction = { on: "milestone"; kinds: string[]; title: string; action: string; ask: boolean };

/**
 * A page's history, format 2: its reading action (the bars over a stretch are counted from it), its own bars, its
 * milestones and a milestone's card — actions of the plugin —; its vocabulary of points, `kinds`, in the legend's
 * order; `small` and `flag`, the sentences that promise small points and flags; its comparisons, narrowing the
 * passport's; and the actions it offers on a milestone. A page that gives none is offered one moment only.
 */
export type PageHistory = {
  read?: string;
  bars?: string;
  milestones?: string;
  card?: string;
  compare?: Comparison[];
  kinds?: Record<string, Kind>;
  small?: string;
  flag?: string;
  actions?: MilestoneAction[];
};

/** What a plugin version allows: its actions' names and its passport's `history.compare`. */
export type HistoryAllowed = { actions: readonly string[]; compare: readonly string[] };

const NAME = /^[a-z][a-z0-9_]{0,62}$/;
const KIND = /^[a-z][a-z0-9_]{0,31}$/;
const ROLES = ["read", "bars", "milestones", "card"] as const;
/** The most kinds a page may declare, and the longest words it may give. */
export const MAX_KINDS = 12;
const TERM = 40;
const DEF = 200;
const PROMISE = 160;

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);

/** The history, when a message carries one of a known shape; null otherwise. Words are checked by checkHistory. */
export function historyOf(value: unknown): PageHistory | null {
  if (!record(value)) return null;
  const history: PageHistory = {};
  for (const role of ROLES) {
    const name = value[role];
    if (name === undefined) continue;
    if (typeof name !== "string" || !NAME.test(name)) return null;
    history[role] = name;
  }
  if (value.compare !== undefined) {
    if (!Array.isArray(value.compare) || !value.compare.every((each) => (COMPARISONS as readonly unknown[]).includes(each))) return null;
    history.compare = [...new Set(value.compare as Comparison[])];
  }
  if (value.kinds !== undefined) {
    if (!record(value.kinds)) return null;
    const kinds: Record<string, Kind> = {};
    for (const [key, kind] of Object.entries(value.kinds)) {
      if (!record(kind) || !["tone", "look", "lead", "term", "def"].every((field) => text(kind[field]))) return null;
      kinds[key] = { tone: kind.tone, look: kind.look, lead: kind.lead, term: kind.term, def: kind.def } as Kind;
    }
    history.kinds = kinds;
  }
  for (const promise of ["small", "flag"] as const) {
    if (value[promise] === undefined) continue;
    if (!text(value[promise])) return null;
    history[promise] = value[promise] as string;
  }
  if (value.actions !== undefined) {
    if (!Array.isArray(value.actions)) return null;
    const actions: MilestoneAction[] = [];
    for (const action of value.actions) {
      if (!record(action) || !text(action.on) || !strings(action.kinds) || !text(action.title) || !text(action.action) || typeof action.ask !== "boolean") return null;
      actions.push({ on: action.on as "milestone", kinds: action.kinds, title: action.title, action: action.action, ask: action.ask });
    }
    history.actions = actions;
  }
  return history;
}

/**
 * The core's check of a page's history: every action it names must be one of the version's, its comparisons must
 * narrow the passport's, its kinds must hold the core's words, its promises must be short, and an action on a
 * milestone must name declared kinds. What does not hold is refused by name and left out; the rest is kept.
 */
export function checkHistory(history: PageHistory, allowed: HistoryAllowed): { kept: PageHistory; refused: string[] } {
  const actions = new Set(allowed.actions);
  const refused: string[] = [];
  const kept: PageHistory = { ...history };
  for (const role of ROLES) {
    const name = history[role];
    if (name !== undefined && !actions.has(name)) {
      refused.push(`${role} names ${JSON.stringify(name)}, which is no action of the plugin`);
      delete kept[role];
    }
  }
  if (history.compare) {
    const wider = history.compare.filter((each) => !allowed.compare.includes(each));
    for (const each of wider) refused.push(`compare offers ${JSON.stringify(each)}, which the passport's history does not`);
    kept.compare = history.compare.filter((each) => allowed.compare.includes(each));
  } else {
    kept.compare = allowed.compare.filter((each): each is Comparison => (COMPARISONS as readonly string[]).includes(each));
  }
  if (history.kinds) {
    const kinds: Record<string, Kind> = {};
    for (const [key, kind] of Object.entries(history.kinds)) {
      if (!KIND.test(key)) refused.push(`the kind ${JSON.stringify(key)} is no name of a kind`);
      else if (Object.keys(kinds).length >= MAX_KINDS) refused.push(`the kind ${JSON.stringify(key)} is past the ${MAX_KINDS} a page may declare`);
      else if (!(TONES as readonly string[]).includes(kind.tone)) refused.push(`the kind ${JSON.stringify(key)} has the tone ${JSON.stringify(kind.tone)}, which is not of the core's palette`);
      else if (!(LOOKS as readonly string[]).includes(kind.look)) refused.push(`the kind ${JSON.stringify(key)} has the look ${JSON.stringify(kind.look)}, which the core does not draw`);
      else if (!(LEADS as readonly string[]).includes(kind.lead)) refused.push(`the kind ${JSON.stringify(key)} has the lead ${JSON.stringify(kind.lead)}, which the core does not draw`);
      else kinds[key] = { ...kind, term: kind.term.slice(0, TERM), def: kind.def.slice(0, DEF) };
    }
    kept.kinds = kinds;
  }
  for (const promise of ["small", "flag"] as const) {
    const sentence = history[promise];
    if (sentence !== undefined && sentence.length > PROMISE) {
      refused.push(`${promise} is longer than ${PROMISE} characters`);
      delete kept[promise];
    }
  }
  if (history.actions) {
    const declared = new Set(Object.keys(kept.kinds ?? {}));
    kept.actions = history.actions.filter((each) => {
      if (each.on !== "milestone") refused.push(`an action is offered on ${JSON.stringify(each.on)}; only on a milestone`);
      else if (!actions.has(each.action)) refused.push(`an action names ${JSON.stringify(each.action)}, which is no action of the plugin`);
      else if (!each.kinds.length || each.kinds.some((kind) => !declared.has(kind))) refused.push(`the action ${JSON.stringify(each.action)} names a kind the page did not declare`);
      else return true;
      return false;
    });
  }
  return { kept, refused };
}

/** What a page that gives no history is offered: one moment, no bars, no milestones, no comparison. */
export const NO_HISTORY: PageHistory = { compare: [] };
