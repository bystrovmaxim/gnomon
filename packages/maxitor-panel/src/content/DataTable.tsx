// @maxitor/panel — a table of the panel's content: one row per record, the columns named.
import type { ReactNode } from "react";

export type Column<Row> = { title: string; value: (row: Row) => ReactNode };

export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  anchor,
  empty = "Nothing here yet.",
}: {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  /** A row's anchor on every screen: what another person's pointer lands on (#76). */
  anchor?: (row: Row) => string;
  empty?: string;
}) {
  if (rows.length === 0) return <div className="mx-empty">{empty}</div>;
  return (
    <table className="mx-table">
      <thead>
        <tr>{columns.map((column) => <th key={column.title}>{column.title}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} data-room-anchor={anchor?.(row)}>
            {columns.map((column) => <td key={column.title}>{column.value(row)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
