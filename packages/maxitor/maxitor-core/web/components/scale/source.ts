// packages/maxitor/maxitor-core/web/components/scale/source.ts
// Where the scale reads a page's history (spec 079, FR-013, FR-015, FR-017): the plugin's history actions through the
// gateway, at /p/<plugin>/api/<organization>/history/<action>, with the organization's token the gateway adds. Every
// call carries the open node's path parameters, the page's own address parameters, and the stretch and the bar's
// width — never what is on the screen. The core's test page answers from fixtures in the page's memory instead.

import type { Bar, CardBlock } from "@maxitor/panel/history";
import { barsOf, blocksOf } from "@maxitor/panel/history";
import type { PageHistory } from "@maxitor/panel/protocol";

import { BarCache } from "@/components/scale/cache";

export type HistorySource = {
  /** What identifies the page's questions in the cache: its owner, organization, node and parameters. */
  key: string;
  /** The bars of the stretch [from, to), `width` seconds each; null when the page has none or the answer failed. */
  bars: ((from: string, to: string, width: number) => Promise<Bar[] | null>) | null;
  /** The milestones of the stretch, as answered: the core checks them against the setup. */
  milestones: ((from: string, to: string) => Promise<unknown>) | null;
  /** A milestone's card at a moment; empty when there is none. */
  card: ((id: string, at: string | null) => Promise<CardBlock[]>) | null;
};

/** The names a page's own address parameter may not have when it is passed to a history action: the core's. */
const RESERVED = new Set(["at", "mode", "from"]);

/** The parameters every call of a page carries: the node's path parameters, then the page's address parameters. */
export function callParameters(scope: Record<string, string>, query: Record<string, string>): Record<string, string> {
  const own = Object.fromEntries(Object.entries(query).filter(([name]) => !RESERVED.has(name) && !name.startsWith("_")));
  return { ...own, ...scope };
}

async function ask(url: string): Promise<unknown> {
  const answer = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!answer.ok) throw new Error(`${url} answered ${answer.status}`);
  return answer.json();
}

/**
 * The history of a plugin's page through the gateway. The milestones and the card get the node's path parameters
 * only: a page's filters narrow its notes and bars, never its milestones.
 */
export function gatewaySource(owner: string, code: string, history: PageHistory, scope: Record<string, string>, query: Record<string, string>): HistorySource {
  const base = `/p/${encodeURIComponent(owner)}/api/${encodeURIComponent(code)}/history`;
  const url = (action: string, params: Record<string, string>) => `${base}/${encodeURIComponent(action)}?${new URLSearchParams(params).toString()}`;
  const params = callParameters(scope, query);
  const barsAction = history.bars ?? history.read;
  return {
    key: BarCache.keyOf(owner, code, barsAction ?? "", params),
    bars: barsAction
      ? async (from, to, width) => barsOf(await ask(url(barsAction, { ...params, from_at: from, to_at: to, width: String(width) })))
      : null,
    milestones: history.milestones ? async (from, to) => ask(url(history.milestones as string, { ...scope, from_at: from, to_at: to })) : null,
    card: history.card
      ? async (id, at) => blocksOf(await ask(url(history.card as string, { ...scope, id, ...(at ? { at } : {}) })))
      : null,
  };
}
