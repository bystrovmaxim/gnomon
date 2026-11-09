// src/lib/erdLayoutClient.ts
/**
 * The page's side of the ERD's layout worker (#85): one worker for the page, requests numbered and answered in order.
 * Where a worker cannot be started, or cannot be handed the data, the picture is made on the page, as before.
 */
import { layOutErd, type ErdLayoutRequest, type ErdLayoutResult } from "./erdLayout.ts";
import { loadGraphvizWasmFor } from "./prefetch/erdGraphviz.ts";

type Waiting = { resolve: (result: ErdLayoutResult) => void; reject: (error: Error) => void };

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, Waiting>();

function layoutWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("../workers/erdLayout.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; result?: ErdLayoutResult; error?: string }>) => {
      const { id, result, error } = event.data;
      const one = waiting.get(id);
      waiting.delete(id);
      if (!one) return;
      if (result) one.resolve(result);
      else one.reject(new Error(error ?? "the layout failed"));
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** The picture of ``request``, made in the layout worker. */
export function layOutErdOffPage(request: ErdLayoutRequest): Promise<ErdLayoutResult> {
  const off = layoutWorker();
  if (!off) return layOutErd(request, loadGraphvizWasmFor);
  const id = (nextId += 1);
  return new Promise<ErdLayoutResult>((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    try {
      off.postMessage({ id, request });
    } catch {
      waiting.delete(id);
      layOutErd(request, loadGraphvizWasmFor).then(resolve, reject);
    }
  });
}
