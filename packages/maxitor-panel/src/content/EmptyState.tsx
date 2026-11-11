// @maxitor/panel — what a page shows when it has nothing to show: a dashed card with a title and one line, as the
// mockup of spec 074 draws "No notes yet". A page never leaves bare text on the field.
import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-empty-state" role="status">
      <b>{title}</b>
      {children}
    </div>
  );
}
