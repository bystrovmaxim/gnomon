// @maxitor/panel — what happened to an element, as the graph viewer's StatusIcon draws it: the disk of the filter panel
// in the change's colour with its sign, 14 px.
"use client";

import { CHANGE_SIGN, type Change } from "./changes";

export function StatusIcon({ status }: { status: Change | "unchanged" }) {
  return (
    <span className="mx-status" data-status={status} role="img" aria-label={status} title={status}>
      {CHANGE_SIGN[status]}
    </span>
  );
}
