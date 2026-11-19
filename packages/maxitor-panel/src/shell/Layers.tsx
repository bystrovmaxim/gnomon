// @maxitor/panel — the shell owns the placement and URL of the shared layer pills.
"use client";

import type { Query } from "../protocol";
import { Pills } from "../content/Pills";
import { chosen, LAYER, writeChoice } from "./address";
import { Icon } from "./icons";
import type { Layers as LayersInput } from "./types";

export function Layers({ layers, query, write }: { layers: LayersInput; query: Query; write: (name: string, value: string | null) => void }) {
  const param = layers.param ?? LAYER;
  const current = chosen(query[param], layers.default, layers.options.map((option) => option.value));
  const withIcons = layers.options.every(option => option.icon);
  return <Pills className={`mx-layer-pill ${withIcons ? "with-icons" : "with-labels"}`} role="radiogroup" label={layers.label ?? "Layer"} data-shell="layers"
    value={current} onChange={(value) => write(param, writeChoice(value, layers.default))}
    options={layers.options.map(option => ({ ...option, icon: option.icon ? <Icon name={option.icon} /> : undefined }))} />;
}
