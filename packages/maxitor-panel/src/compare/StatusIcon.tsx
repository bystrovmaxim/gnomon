// @maxitor/panel — what happened to an element, as the graph viewer's StatusIcon draws it: the disk of the filter panel
// in the change's colour with its sign, 14 px.
"use client";

import { CHANGE_SIGN, type Change } from "./changes";
import { StatusDisk } from "./StatusDisk";

export function StatusIcon({ status }: { status: Change | "unchanged" }) {
  return <StatusDisk className="mx-status" fill={`var(--mx-change-${status})`} sign={CHANGE_SIGN[status]} label={status} />;
}
