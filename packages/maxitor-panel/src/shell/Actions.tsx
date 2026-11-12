// @maxitor/panel — the row in the panel's top right corner, bottom right on a phone (spec 078, FR-007; spec 079, FR-027):
// the comparison's stepper first, then the page's actions. The actions show only at now: in the past and in a
// comparison everything is read only. An action a page offers on a milestone shows exactly on that milestone, and
// never in a comparison.
"use client";

import type { ReactNode } from "react";

import { Icon } from "./icons";
import type { PageAction } from "./types";

export function Actions({ actions, stepper }: { actions: PageAction[]; stepper?: ReactNode }) {
  return (
    <div className="mx-actions" data-shell="actions">
      {stepper}
      {actions.map((action) => (
        <button key={action.title} type="button" className="mx-action" onClick={action.onClick}>
          {action.icon ? <Icon name={action.icon} /> : null}
          {action.title}
        </button>
      ))}
    </div>
  );
}
