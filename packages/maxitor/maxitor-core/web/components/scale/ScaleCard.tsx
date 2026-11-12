// packages/maxitor/maxitor-core/web/components/scale/ScaleCard.tsx
// The card hanging from the pill (spec 079, FR-001, FR-011, FR-012), ported from the graph viewer's VersionPicker: 11 px
// under the pill, its right edge under the pill's, 760 px wide — a sheet from the bottom on a phone. Its head says
// what the scale is of on the left; on the right the page's tools, the "i" of the legend and the mode switch with only
// what the page offers. Under it the zoom's presets and the stretch in view, the scale, and how to move on it.
"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Legend } from "@/components/scale/Legend";
import type { LegendSection } from "@/components/scale/legendRows";
import { PRESETS } from "@/components/scale/geometry";

import type { Mode } from "@/components/scale/bridge";

/** The graph viewer's mode switch pictograms, 14 px strokes. */
const MODES: { value: Mode; label: string; phone: string; icon: ReactNode }[] = [
  { value: "one", label: "One", phone: "One", icon: <rect x={5} y={5} width={14} height={14} rx={2} /> },
  {
    value: "diff",
    label: "Diff",
    phone: "Diff",
    icon: (
      <>
        <rect x={4} y={4} width={16} height={16} rx={2} />
        <path d="M8.5 9.5h4M10.5 7.5v4M8.5 15.5h4" />
      </>
    ),
  },
  {
    value: "side_by_side",
    label: "Side by side",
    phone: "A / B",
    icon: (
      <>
        <rect x={3.5} y={5} width={17} height={14} rx={2} />
        <path d="M12 5v14" />
      </>
    ),
  },
];

function InfoIcon() {
  return (
    <svg className="mx-card-icon" viewBox="0 0 24 24" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <circle cx={12} cy={12} r={8.5} />
        <path d="M12 11v5.2M12 7.9v.2" />
      </g>
    </svg>
  );
}

/** The mode switch: One always; Diff and Side by side only as the page offers them, usable once their step lands. */
function ModeSwitch({ value, offered, onMode }: { value: Mode; offered: readonly Mode[]; onMode: ((mode: Mode) => void) | null }) {
  return (
    <div className="mx-modes" role="radiogroup" aria-label="Mode">
      {MODES.filter((mode) => mode.value === "one" || offered.includes(mode.value)).map((mode) => {
        const on = mode.value === value;
        const enabled = on || onMode !== null;
        return (
          <button key={mode.value} type="button" role="radio" aria-checked={on} className={on ? "on" : ""} disabled={!enabled} onClick={() => !on && onMode?.(mode.value)}>
            <svg className="mx-mode-icon" viewBox="0 0 24 24" aria-hidden>
              <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                {mode.icon}
              </g>
            </svg>
            <span className="mx-mode-desk">{mode.label}</span>
            <span className="mx-mode-phone">{mode.phone}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ScaleCard({
  title,
  subtitle,
  tools,
  legend,
  mode,
  offered,
  onMode,
  span,
  onPreset,
  phone,
  onClose,
  children,
  under,
}: {
  title: string;
  subtitle: string;
  /** The page's own tools in the head, before the "i": the switch of small points. */
  tools?: ReactNode;
  legend: LegendSection[];
  mode: Mode;
  offered: readonly Mode[];
  onMode: ((mode: Mode) => void) | null;
  /** The stretch in view, as the head of the scale says it, with its dates in the title. */
  span: { text: string; title: string };
  onPreset: (span: number | null) => void;
  phone: boolean;
  onClose: () => void;
  /** The scale itself. */
  children: ReactNode;
  /** Under the scale: the comments of the milestones in force. */
  under?: ReactNode;
}) {
  const [legendOpen, setLegendOpen] = useState(false);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (legendOpen) setLegendOpen(false);
      else onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [legendOpen, onClose]);

  return (
    <div className="mx-card" role="dialog" aria-label="Pick a moment">
      <div className="mx-card-grab" aria-hidden />
      <div className="mx-card-head">
        <div className="mx-card-title">
          <b title={title}>{title}</b>
          <span>{subtitle}</span>
        </div>
        <div className="mx-card-tools">
          {tools}
          <button type="button" className={`mx-card-tool${legendOpen ? " on" : ""}`} aria-label="Reading the scale" aria-expanded={legendOpen} onClick={() => setLegendOpen(!legendOpen)}>
            <InfoIcon />
          </button>
          <ModeSwitch value={mode} offered={offered} onMode={onMode} />
        </div>
      </div>
      {legendOpen ? <Legend sections={legend} comparing={mode !== "one"} /> : null}
      <div className="mx-card-bar">
        <span className="mx-zoom" role="group" aria-label="Zoom">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" onClick={() => onPreset(preset.span)}>
              {preset.label}
            </button>
          ))}
        </span>
        <span className="mx-card-span" title={span.title}>{span.text}</span>
      </div>
      {children}
      <div className="mx-card-hint">
        {phone
          ? "Drag to move · tap to choose"
          : `Drag across the scale to zoom into a stretch${mode !== "one" ? " · drag A along the top edge, B along the axis · Shift-drag between them moves both, Shift-click centres them" : ""} · wheel to zoom · Shift-wheel or swipe sideways to move · click to choose`}
      </div>
      {under}
    </div>
  );
}
