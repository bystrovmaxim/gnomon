// @maxitor/panel — the bottom bar at the bottom left, made from maxitor-web's ZoomToolbar (spec 078, FR-005, FR-006,
// FR-009): zoom out, the percentage, zoom in and fit first on a canvas, then the page's sections, each behind a
// hairline. On a phone, sections that would not fit fold into one "⋯" menu.
"use client";

import { Fragment, useState } from "react";

import type { Query } from "../protocol";
import { chosen, writeChoice } from "./address";
import { foldsOnPhone } from "./fold";
import { Icon } from "./icons";
import type { Zoom } from "./ShellContext";
import type { BarSection } from "./types";

type Write = (name: string, value: string | null) => void;

function Section({ section, query, write }: { section: BarSection; query: Query; write: Write }) {
  if (section.kind === "choice") {
    const current = chosen(query[section.param], section.default, section.options.map((option) => option.value));
    return (
      <span role="radiogroup" className="mx-bar-group">
        {section.options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === current}
            aria-label={option.title}
            title={option.title}
            className={option.value === current ? "on" : ""}
            onClick={() => write(section.param, writeChoice(option.value, section.default))}
          >
            <Icon name={option.icon} />
          </button>
        ))}
      </span>
    );
  }
  if (section.kind === "button") {
    return (
      <span className="mx-bar-group">
        {section.items.map((item) => (
          <button key={item.title} type="button" aria-label={item.title} title={item.title} disabled={item.disabled} onClick={item.onClick}>
            <Icon name={item.icon} />
          </button>
        ))}
      </span>
    );
  }
  return (
    <button type="button" aria-label={section.title} title={section.title} aria-pressed={section.on} className={section.on ? "on" : ""} onClick={() => section.onChange(!section.on)}>
      <Icon name={section.icon} />
    </button>
  );
}

export function BottomBar({ zoom, sections, query, write }: { zoom: Zoom | null; sections: BarSection[]; query: Query; write: Write }) {
  const [menu, setMenu] = useState(false);
  if (!zoom && sections.length === 0) return null;
  const folds = foldsOnPhone(sections);
  const drawn = sections.map((section, index) => (
    <Fragment key={index}>
      {zoom || index > 0 ? <span className="mx-bar-hairline" aria-hidden /> : null}
      <Section section={section} query={query} write={write} />
    </Fragment>
  ));
  return (
    <div className={`mx-bar${folds ? " folds" : ""}`} role="toolbar" aria-label="View controls" data-shell="bar">
      {zoom ? (
        <>
          <button type="button" aria-label="Zoom out" title="Zoom out" onClick={zoom.zoomOut}>−</button>
          <span className="mx-bar-value" aria-live="polite">{Math.round(zoom.zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={zoom.zoomIn}>+</button>
          <button type="button" aria-label="Fit" title="Fit" onClick={zoom.fit}>⤢</button>
        </>
      ) : null}
      <span className="mx-bar-sections">{drawn}</span>
      {folds ? (
        <span className="mx-bar-more">
          <span className="mx-bar-hairline" aria-hidden />
          <button type="button" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>⋯</button>
          {menu ? <span className="mx-bar-menu">{drawn}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
