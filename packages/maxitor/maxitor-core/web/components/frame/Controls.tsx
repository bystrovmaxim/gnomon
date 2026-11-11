// packages/maxitor/maxitor-core/web/components/frame/Controls.tsx
// The controls over the right panel (spec 077, FR-033 – FR-037; the plugin concept, 7.8): a plugin declares them in
// navigation.yaml, the core draws them, the same places and look for every plugin. Each control is an address
// parameter: a default is never written; a filter lists the options switched on and is absent when all are on. The
// page hears every change as panel.location.
"use client";

import { paletteColour, PALETTE, type PaletteColour } from "@maxitor/tokens";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { windowAddress, type PanelAddress } from "@/lib/address";
import type { Choice, Controls as Declared } from "@/lib/tree";

type Option = { value: string; label: string; colour?: string };
type Row = { label: string; colour: string };

/** A colour of the palette by its name; grey for a name the palette does not have. */
function colourOf(name: string | undefined): string {
  return paletteColour((PALETTE as readonly string[]).includes(name ?? "") ? (name as PaletteColour) : "grey");
}

/** Read an owner's reading action through the gateway, at the panel's moment, with the scope's parameters. */
async function read<T>(owner: string, code: string, action: string, scope: Record<string, string>, at: string | null): Promise<T | null> {
  const query = new URLSearchParams(scope);
  if (at) query.set("at", at);
  try {
    const answer = await fetch(`/p/${encodeURIComponent(owner)}/api/${encodeURIComponent(code)}/lists/${encodeURIComponent(action)}?${query}`, { cache: "no-store" });
    return answer.ok ? ((await answer.json()) as T) : null;
  } catch {
    return null;
  }
}

type Entries = { entries: { key: string; title: string; colour?: string; count?: number }[] };

/** Options from the file, or from the owner's source in the shape of a list: key → value, title → label. */
function useOptions(owner: string, code: string, source: string | undefined, fixed: Option[] | undefined, scope: Record<string, string>, at: string | null) {
  const [loaded, setLoaded] = useState<Option[] | null>(null);
  const key = JSON.stringify([owner, code, source, scope, at]);
  useEffect(() => {
    if (!source) return;
    let live = true;
    void read<Entries>(owner, code, source, scope, at).then((answer) => {
      if (live) setLoaded(answer ? answer.entries.map((e) => ({ value: e.key, label: e.title, colour: e.colour })) : []);
    });
    return () => {
      live = false;
    };

  }, [key]);
  return source ? loaded : (fixed ?? []);
}

export function Controls({
  code,
  owner,
  controls,
  address,
  scope,
}: {
  code: string;
  owner: string;
  controls: Declared;
  address: PanelAddress;
  scope: Record<string, string>;
}) {
  const router = useRouter();
  const set = (param: string, value: string | null) => {
    const query = { ...address.query };
    if (value === null) delete query[param];
    else query[param] = value;
    router.push(windowAddress(code, owner, address.path, query, address.at), { scroll: false });
  };
  return (
    <>
      {controls.mode ? <ModePill code={code} owner={owner} mode={controls.mode} address={address} scope={scope} set={set} /> : null}
      {controls.views ? <ViewSwitch views={controls.views} value={address.query[controls.views.param]} set={set} /> : null}
      {controls.filters?.length ? <Filters code={code} owner={owner} filters={controls.filters} address={address} scope={scope} set={set} /> : null}
      {controls.legend ? <Legend code={code} owner={owner} legend={controls.legend} address={address} scope={scope} /> : null}
    </>
  );
}

type Set = (param: string, value: string | null) => void;

function ModePill({ code, owner, mode, address, scope, set }: { code: string; owner: string; mode: NonNullable<Declared["mode"]>; address: PanelAddress; scope: Record<string, string>; set: Set }) {
  const chosen = address.query[mode.param] ?? mode.default;
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = JSON.stringify([scope, address.at, address.query]);
  useEffect(() => {
    if (!mode.counts) return;
    let live = true;
    void read<{ counts: Record<string, number> }>(owner, code, mode.counts, { ...scope, ...address.query }, address.at).then((answer) => {
      if (live && answer) setCounts(answer.counts);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return (
    <div className="mx-pill" role="radiogroup" aria-label="Mode">
      {mode.options.map((option: Choice) => (
        <button key={option.value} type="button" role="radio" aria-checked={option.value === chosen} className={option.value === chosen ? "on" : ""} onClick={() => set(mode.param, option.value === mode.default ? null : option.value)}>
          {option.label}
          {counts[option.value] !== undefined ? <span className="mx-count">{counts[option.value]}</span> : null}
        </button>
      ))}
    </div>
  );
}

function ViewSwitch({ views, value, set }: { views: NonNullable<Declared["views"]>; value: string | undefined; set: Set }) {
  const chosen = value ?? views.default;
  const choose = (next: string) => set(views.param, next === views.default ? null : next);
  return (
    <div className="mx-views">
      <div className="mx-views-wide" role="radiogroup" aria-label="View">
        {views.options.map((option) => (
          <button key={option.value} type="button" role="radio" aria-checked={option.value === chosen} className={option.value === chosen ? "on" : ""} onClick={() => choose(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      {/* On a phone the view is a menu, the same for every plugin. */}
      <select className="mx-views-narrow" aria-label="View" value={chosen} onChange={(event) => choose(event.target.value)}>
        {views.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function Filters({ code, owner, filters, address, scope, set }: { code: string; owner: string; filters: NonNullable<Declared["filters"]>; address: PanelAddress; scope: Record<string, string>; set: Set }) {
  const [openSection, setOpenSection] = useState(0);
  const [folded, setFolded] = useState(true);
  const switchedOff = filters.reduce((n, f) => n + (address.query[f.param] !== undefined ? 1 : 0), 0);
  return (
    <aside className={`mx-filters${folded ? " folded" : ""}`} aria-label="Filters">
      <button type="button" className="mx-filters-button" aria-expanded={!folded} onClick={() => setFolded(!folded)}>
        Filters{switchedOff ? <span className="mx-count">{switchedOff}</span> : null}
      </button>
      <div className="mx-filters-body">
        {filters.map((filter, index) => (
          <FilterSection
            key={filter.param}
            code={code}
            owner={owner}
            filter={filter}
            open={index === openSection}
            onOpen={() => setOpenSection(index)}
            address={address}
            scope={scope}
            set={set}
          />
        ))}
      </div>
    </aside>
  );
}

function FilterSection({ code, owner, filter, open, onOpen, address, scope, set }: { code: string; owner: string; filter: NonNullable<Declared["filters"]>[number]; open: boolean; onOpen: () => void; address: PanelAddress; scope: Record<string, string>; set: Set }) {
  const options = useOptions(owner, code, filter.source, filter.options, scope, address.at);
  const listed = address.query[filter.param];
  const known = new Set((options ?? []).map((o) => o.value));
  // An option the address lists that the source no longer gives is ignored, and dropped at the next change.
  const on = new Set(listed === undefined ? known : listed.split(",").filter((value) => known.has(value)));
  const toggle = (value: string) => {
    const next = new Set(on);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    const all = (options ?? []).every((o) => next.has(o.value));
    set(filter.param, all ? null : (options ?? []).map((o) => o.value).filter((v) => next.has(v)).join(","));
  };
  return (
    <section className="mx-filter">
      <button type="button" className="mx-filter-title" aria-expanded={open} onClick={onOpen}>{filter.title}</button>
      {open ? (
        <div role="group" aria-label={filter.title}>
          {options === null ? <div className="mx-filter-note">Loading…</div> : null}
          {options?.length === 0 ? <div className="mx-filter-note">Nothing to filter by.</div> : null}
          {options?.map((option) => (
            <button key={option.value} type="button" role="checkbox" aria-checked={on.has(option.value)} className={`mx-filter-row${on.has(option.value) ? "" : " off"}`} onClick={() => toggle(option.value)}>
              <span className="mx-disk" style={{ background: colourOf(option.colour) }} />
              <span className="mx-filter-label">{option.label}</span>
              {on.has(option.value) ? null : <span className="mx-filter-off">off</span>}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Legend({ code, owner, legend, address, scope }: { code: string; owner: string; legend: NonNullable<Declared["legend"]>; address: PanelAddress; scope: Record<string, string> }) {
  const loaded = useOptions(owner, code, legend.source, undefined, scope, address.at);
  const rows: Row[] = legend.source ? (loaded ?? []).map((o) => ({ label: o.label, colour: o.colour ?? "grey" })) : (legend.items ?? []);
  return (
    <aside className="mx-legend" aria-label={legend.title}>
      <div className="mx-legend-title">{legend.title}</div>
      {rows.map((row) => (
        <div key={row.label} className="mx-legend-row">
          <span className="mx-disk" style={{ background: colourOf(row.colour) }} />
          {row.label}
        </div>
      ))}
    </aside>
  );
}
