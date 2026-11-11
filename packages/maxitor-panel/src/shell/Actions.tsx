// @maxitor/panel — the page's actions at the top right, bottom right on a phone (spec 078, FR-007). They show only at
// now: in the past and in a comparison everything is read only, and the time scale's change stepper takes the place.
"use client";

import { Icon } from "./icons";
import type { PageAction } from "./types";

export function Actions({ actions }: { actions: PageAction[] }) {
  return (
    <div className="mx-actions" data-shell="actions">
      {actions.map((action) => (
        <button key={action.title} type="button" className="mx-action" onClick={action.onClick}>
          {action.icon ? <Icon name={action.icon} /> : null}
          {action.title}
        </button>
      ))}
    </div>
  );
}
