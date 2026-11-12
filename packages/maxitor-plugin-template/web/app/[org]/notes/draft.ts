// web/app/[org]/notes/draft.ts — what the draft's and the published notes' pages decide without a browser: the
// state's words and colour, the State filter's rows, the order of the cards, the conflict's words and the marks
// publishing shows on Published. Pure functions, tested by web/tests/draft.test.ts.

import { when } from "./notes.ts";

/** What a change does to a note. */
export type ChangeState = "new" | "changed" | "deleted";

/** One change of the person's draft, as the template's backend answers it. */
export type Change = {
  note_id: string;
  state: ChangeState;
  body: string;
  base_body: string | null;
  base_revision: number | null;
  writer_id: string;
  writer_name: string;
  changed_at: string;
  conflict: boolean;
  published_body: string | null;
  published_by_name: string;
  published_at: string;
};

/** The states in the order the filter and the head count them. */
export const STATES: ChangeState[] = ["new", "changed", "deleted"];

/** The words the State filter and a card say for a state. */
export const STATE_LABEL: Record<ChangeState, string> = { new: "New", changed: "Changed", deleted: "Deleted" };

/** The palette colour and the sign of a state's disk. */
export const STATE_MARK: Record<ChangeState, { colour: string; mark: string }> = {
  new: { colour: "green", mark: "+" },
  changed: { colour: "amber", mark: "~" },
  deleted: { colour: "red", mark: "−" },
};

/** A row of the shell's State filter, as @maxitor/panel reads it. */
export type StateRow = { key: ChangeState; label: string; colour: string; mark: string; absent: boolean };

/** What a card's foot says about the published note the change was made over. */
export function baseLine(change: Change): string {
  const note = change.writer_name === "" ? "the note" : `${change.writer_name}'s note`;
  if (change.state === "new") return "Written by you; not published yet";
  return `${note} as v${change.base_revision ?? "—"} has it · you ${change.state === "changed" ? "changed" : "deleted"} it`;
}

/** The states the person has switched on in the shell's filter; all of them when the parameter is absent. */
export function visibleStates(param: string | undefined): Set<ChangeState> {
  const chosen = param ? (param.split(",").filter(Boolean) as ChangeState[]) : [];
  return chosen.length ? new Set(chosen) : new Set(STATES);
}

/** The changes the State filter lets stand. */
export function visibleChanges(changes: readonly Change[], param: string | undefined): Change[] {
  const on = visibleStates(param);
  return changes.filter((change) => on.has(change.state));
}

/** The State filter's rows, a state with nothing behind it faint. */
export function stateRows(changes: readonly Change[]): StateRow[] {
  return STATES.map((state) => ({
    key: state,
    label: STATE_LABEL[state],
    colour: STATE_MARK[state].colour,
    mark: STATE_MARK[state].mark,
    absent: !changes.some((change) => change.state === state),
  }));
}

/** The cards' order: the change made last first. */
export function draftOrder(changes: readonly Change[]): Change[] {
  return [...changes].sort((a, b) => (a.changed_at < b.changed_at ? 1 : a.changed_at > b.changed_at ? -1 : 0));
}

/** How many changes of each state the draft holds. */
export function counts(changes: readonly Change[]): Record<ChangeState, number> {
  return {
    new: changes.filter((change) => change.state === "new").length,
    changed: changes.filter((change) => change.state === "changed").length,
    deleted: changes.filter((change) => change.state === "deleted").length,
  };
}

/** The changes that meet someone else's publication. */
export function conflictsOf(changes: readonly Change[]): Change[] {
  return changes.filter((change) => change.conflict);
}

/** The notice above the cards when someone published over the draft's base; null when nobody did. */
export function raceLine(changes: readonly Change[]): string | null {
  const conflicts = conflictsOf(changes);
  if (!conflicts.length) return null;
  const latest = conflicts.reduce((last, change) => (change.published_at > last.published_at ? change : last));
  const base = baseRevisionOf(changes);
  const what = latest.published_body === null ? "deleted one of them" : "published";
  return `${latest.published_by_name} ${what} on ${when(latest.published_at)}, after v${base ?? "—"} your draft was made over. ${conflicts.length} of your changes meet theirs: when you publish, you choose for each one — overwrite or give up.`;
}

/** The revision the draft counts from: the smallest base any of its changes names. */
export function baseRevisionOf(changes: readonly Change[]): number | null {
  const revisions = changes.map((change) => change.base_revision).filter((number): number is number => number !== null);
  return revisions.length ? Math.min(...revisions) : null;
}

/** What waits in the draft, as Published says it: "3 changes", or nothing when the draft is empty. */
export function waitingLine(changes: readonly Change[]): string {
  const total = changes.length;
  return `${total} ${total === 1 ? "change" : "changes"}`;
}

/** The state each note waits in, by the note's id, so Published can mark its cards. */
export function marksInDraft(changes: readonly Change[]): Map<string, ChangeState> {
  return new Map(changes.map((change) => [change.note_id, change.state]));
}

/** The words a conflict's choice says. */
export function choiceLabel(change: Change, choice: "overwrite" | "give_up"): string {
  if (choice === "give_up") return change.state === "deleted" ? "Keep theirs" : "Give up mine";
  if (change.state === "deleted") return "Delete it anyway";
  return change.published_body === null ? "Restore it with mine" : "Overwrite with mine";
}

/** The sentence a conflict names, under the two sides. */
export function conflictLine(change: Change): string {
  if (change.state === "deleted") return `You deleted it; ${change.published_by_name} changed it.`;
  if (change.published_body === null) return `You changed it; ${change.published_by_name} deleted it.`;
  return `You changed it; ${change.published_by_name} changed it too.`;
}
