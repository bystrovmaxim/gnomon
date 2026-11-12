// packages/maxitor/maxitor-core/web/components/scale/cache.ts
// The answers of the scale kept in the page's memory (spec 079, FR-017): bars are asked in chunks of 60 bars of one
// width, aligned to the epoch, so a zoom or a move asks only for the chunks it does not have. A chunk that ends at or
// before the watermark never changes and is kept; the chunk holding now is asked again, as the right edge moves.

import type { Bar } from "@maxitor/panel/history";

/** How many bars one question asks for. */
export const CHUNK = 60;

/** A chunk of bars: its index for its width, and the stretch it covers. */
export type Chunk = { index: number; from: number; to: number };

/** The chunks of bars `step` milliseconds wide that a stretch overlaps, from its start to the earlier of its end and now. */
export function chunksOf(from: number, to: number, now: number, step: number): Chunk[] {
  const size = CHUNK * step;
  const end = Math.min(to, now);
  const chunks: Chunk[] = [];
  for (let index = Math.floor(from / size); index * size < end; index += 1) chunks.push({ index, from: index * size, to: (index + 1) * size });
  return chunks;
}

/** The answers kept for one page's history: bars by (what is asked, width, chunk), each with whether it is closed. */
export class BarCache {
  private readonly kept = new Map<string, { bars: Bar[]; closed: boolean }>();

  /** The key of a page's question: its owner, organization, node and parameters, never what is on the screen. */
  static keyOf(owner: string, code: string, action: string, params: Record<string, string>): string {
    return JSON.stringify([owner, code, action, Object.entries(params).sort(([a], [b]) => (a < b ? -1 : 1))]);
  }

  private slot(key: string, step: number, index: number): string {
    return `${key}|${step}|${index}`;
  }

  /** Whether a chunk must be asked: it was never answered, or it held now when it was. */
  missing(key: string, step: number, chunk: Chunk): boolean {
    const found = this.kept.get(this.slot(key, step, chunk.index));
    return !found || !found.closed;
  }

  /** Keep an answer; it is closed when the whole chunk lies at or before the watermark it was read at. */
  put(key: string, step: number, chunk: Chunk, bars: Bar[], watermark: number): void {
    this.kept.set(this.slot(key, step, chunk.index), { bars, closed: chunk.to <= watermark });
  }

  /** The bars kept for a stretch, in time order. */
  bars(key: string, step: number, chunks: readonly Chunk[]): Bar[] {
    return chunks.flatMap((chunk) => this.kept.get(this.slot(key, step, chunk.index))?.bars ?? []);
  }
}
