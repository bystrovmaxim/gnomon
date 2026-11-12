// @maxitor/panel — a list of a page's records, lying whole on the canvas (spec 081, FR-001 – FR-004): a card at full
// length with no scroll of its own and no pages, moved and zoomed by the panel's camera like everything else. Only
// the rows inside the view are drawn; the anchors of all rows are known to the canvas. The head — the list's name,
// how many rows pass of how many, the column names — sticks to the top of the view while the rows go up under it.
// Outside a canvas the list lays one of its own.
"use client";

import { PALETTE, paletteColour, type PaletteColour } from "@maxitor/tokens";
import { useEffect, useMemo, type ReactNode } from "react";

import { MaxitorCanvas, useCanvasOrNull } from "../canvas/MaxitorCanvas";
import { dayLabel } from "../pickers/dates";
import { headOffset, initials, LIST_HEAD, LIST_ROW, LIST_WIDTH, listHeight, rowBounds, rowsInView, viewOf } from "./list";

/** How a cell is drawn: plain text, monospace, a number, a date, a person with a disk, a status with a dot. */
export type CellKind = "text" | "mono" | "number" | "date" | "person" | "status";

export type Column<Row> = {
  title: string;
  value: (row: Row) => ReactNode;
  kind?: CellKind;
  /** A palette colour of @maxitor/tokens for a person's disk or a status's dot. */
  colour?: (row: Row) => string | undefined;
  /** The column's share of the card's width; equal shares when absent. */
  width?: number;
};

function colourOf(name: string | undefined): string {
  return paletteColour((PALETTE as readonly string[]).includes(name ?? "") ? (name as PaletteColour) : "grey");
}

function Cell<Row>({ column, row }: { column: Column<Row>; row: Row }) {
  const value = column.value(row);
  const kind = column.kind ?? "text";
  if (kind === "person" && typeof value === "string") {
    return (
      <span className="mx-list-person">
        <span className="mx-disk" style={{ background: colourOf(column.colour?.(row)) }}>{initials(value)}</span>
        <span>{value}</span>
      </span>
    );
  }
  if (kind === "status") {
    return (
      <span className="mx-list-status">
        <span className="mx-list-dot" style={{ background: colourOf(column.colour?.(row)) }} />
        {value}
      </span>
    );
  }
  if (kind === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return <>{dayLabel(value.slice(0, 10))}</>;
  return <>{value}</>;
}

function Card<Row>({
  name,
  rows,
  total,
  columns,
  rowKey,
  anchor,
  change,
  at,
  empty,
}: {
  name: string;
  rows: Row[];
  total: number;
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  anchor?: (row: Row) => string;
  change?: (row: Row) => string | undefined;
  at: { x: number; y: number };
  empty: string;
}) {
  const canvas = useCanvasOrNull();
  const view = canvas ? viewOf(canvas.camera, canvas.viewport) : { x: 0, y: 0, width: LIST_WIDTH, height: 0 };
  const { start, end } = rowsInView(rows.length, at.y, view);
  const head = headOffset(rows.length, at.y, view);
  const template = columns.map((column) => `${column.width ?? 1}fr`).join(" ");

  // Every row's place, drawn or not: a pointer or another panel finds a row by its anchor (#76, #98).
  const index = useMemo(() => {
    const found = new Map<string, number>();
    if (anchor) rows.forEach((row, position) => found.set(anchor(row), position));
    return found;
  }, [anchor, rows]);
  useEffect(() => {
    if (!canvas || !anchor) return undefined;
    return canvas.register((name) => {
      const position = index.get(name);
      return position === undefined ? null : rowBounds(position, at.x, at.y);
    });
  }, [anchor, at.x, at.y, canvas?.register, index]);

  return (
    <section className="mx-list" style={{ left: at.x, top: at.y, width: LIST_WIDTH, height: listHeight(rows.length) }} data-list={name} data-rows={rows.length}>
      <header className="mx-list-head" style={{ top: head, height: LIST_HEAD }}>
        <div className="mx-list-name">
          <b>{name}</b>
          <span className="mx-list-count">{rows.length === total ? `${total} rows` : `${rows.length} of ${total} rows`}</span>
        </div>
        <div className="mx-list-columns" style={{ gridTemplateColumns: template }}>
          {columns.map((column) => (
            <span key={column.title} className={`kind-${column.kind ?? "text"}`}>{column.title}</span>
          ))}
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="mx-list-empty" style={{ top: LIST_HEAD, height: LIST_ROW }}>{empty}</div>
      ) : (
        rows.slice(start, end).map((row, offset) => (
          <div
            key={rowKey(row)}
            className="mx-list-row"
            data-room-anchor={anchor?.(row)}
            data-change={change?.(row)}
            style={{ top: LIST_HEAD + (start + offset) * LIST_ROW, height: LIST_ROW, gridTemplateColumns: template }}
          >
            {columns.map((column) => (
              <span key={column.title} className={`kind-${column.kind ?? "text"}`}>
                <Cell column={column} row={row} />
              </span>
            ))}
          </div>
        ))
      )}
    </section>
  );
}

/**
 * A list of records on the canvas. ``name`` heads it; ``total`` is how many rows there are before the page's filters
 * (the rows given when absent); ``at`` is where the card lies on the canvas.
 */
export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  anchor,
  change,
  name = "Rows",
  total,
  at = { x: 0, y: 0 },
  empty = "No rows pass the filters",
}: {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  /** A row's anchor on every screen: what another person's pointer lands on (#76). */
  anchor?: (row: Row) => string;
  /** In a comparison, what happened to a row between A and B: its halo, and its fading while the changes paint. */
  change?: (row: Row) => "added" | "changed" | "removed" | "unchanged" | undefined;
  name?: string;
  total?: number;
  at?: { x: number; y: number };
  empty?: string;
}) {
  const canvas = useCanvasOrNull();
  const card = <Card name={name} rows={rows} total={total ?? rows.length} columns={columns} rowKey={rowKey} anchor={anchor} change={change} at={at} empty={empty} />;
  if (canvas) return card;
  // Alone on a page: the list lays its own canvas, opened on its head and first rows.
  const shown = { x: at.x, y: at.y, width: LIST_WIDTH, height: Math.min(listHeight(rows.length), LIST_HEAD + 16 * LIST_ROW) };
  return <MaxitorCanvas bounds={shown} label={name}>{card}</MaxitorCanvas>;
}
