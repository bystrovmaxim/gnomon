// @maxitor/panel — the layer pills at the top centre, made from maxitor-web's ModePill (spec 078, FR-004): one option
// chosen, each with its icon and count, written to `layer`; on a phone only the icon and the count.
"use client";

import type { Query } from "../protocol";
import { chosen, LAYER, writeChoice } from "./address";
import { Icon } from "./icons";
import type { Layers as LayersInput } from "./types";

export function Layers({ layers, query, write }: { layers: LayersInput; query: Query; write: (name: string, value: string | null) => void }) {
  const current = chosen(query[LAYER], layers.default, layers.options.map((option) => option.value));
  return (
    <div className="mx-pill" role="radiogroup" aria-label="Layer" data-shell="layers">
      {layers.options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === current}
          aria-label={option.label}
          className={option.value === current ? "on" : ""}
          onClick={() => write(LAYER, writeChoice(option.value, layers.default))}
        >
          <Icon name={option.icon} />
          <span className="mx-pill-label">{option.label}</span>
          {/* A count not known yet is empty, never zero. */}
          <span className="mx-count">{option.count ?? ""}</span>
        </button>
      ))}
    </div>
  );
}
