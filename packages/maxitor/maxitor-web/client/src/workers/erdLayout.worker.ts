// src/workers/erdLayout.worker.ts
/**
 * The ERD's layout off the page (#85): each message is an ``ErdLayoutRequest`` with its number, each answer the
 * picture or the error, under the same number. Requests are answered one after another, in order.
 */
import { layOutErd, type ErdLayoutRequest } from "@/lib/erdLayout";
import { loadGraphvizWasmFor } from "@/lib/prefetch/erdGraphviz";

let queue: Promise<unknown> = Promise.resolve();

self.onmessage = (event: MessageEvent<{ id: number; request: ErdLayoutRequest }>) => {
  const { id, request } = event.data;
  queue = queue.then(async () => {
    try {
      self.postMessage({ id, result: await layOutErd(request, loadGraphvizWasmFor) });
    } catch (error) {
      self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
    }
  });
};
