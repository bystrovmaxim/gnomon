"use client";
import type { KeyboardEvent, ReactNode } from "react";
import "./pills.css";

export type PillOption<Value extends string> = {
  value: Value;
  label: string;
  icon?: ReactNode;
  count?: number | null;
};

/** Shared appearance and selection; placement and URL ownership stay with the caller. */
export function Pills<Value extends string>({ options, value, onChange, label, role = "tablist", className = "", id, panelId, "data-shell": shell }: {
  options: readonly PillOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  label: string;
  role?: "tablist" | "radiogroup";
  className?: string;
  id?: string;
  panelId?: string;
  "data-shell"?: string;
}) {
  const keys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === "ArrowRight" ? (index + 1) % options.length
      : event.key === "ArrowLeft" ? (index + options.length - 1) % options.length
      : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
    onChange(options[next].value);
  };
  return (
    <div id={id} className={("mx-pills " + className).trim()} role={role} aria-label={label} data-shell={shell}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return <button key={option.value} type="button" role={role === "tablist" ? "tab" : "radio"}
          id={id ? id + "-" + option.value : undefined}
          aria-controls={panelId} aria-selected={role === "tablist" ? selected : undefined}
          aria-checked={role === "radiogroup" ? selected : undefined} aria-label={role === "radiogroup" ? option.label : undefined}
          tabIndex={selected ? 0 : -1} className={selected ? "on" : ""}
          onClick={() => onChange(option.value)} onKeyDown={(event) => keys(event, index)}>
          {option.icon}<span className="mx-pills-label">{option.label}</span>
          <span className="mx-count">{option.count ?? ""}</span>
        </button>;
      })}
    </div>
  );
}
