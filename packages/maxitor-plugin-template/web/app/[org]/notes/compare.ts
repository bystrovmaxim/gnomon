// web/app/[org]/notes/compare.ts — the published notes at two moments compared (spec 079, FR-048 – FR-050): what
// happened to each note between A and B, the notes B lost drawn faintly in Diff, and the changes the stepper walks.
// Pure functions, checked without a browser.

/** A published note as the comparison reads it. */
export type ComparedNote = { id: string; writer_name: string; body: string };

/** What happened to a note between A and B. */
export type NoteChange = "added" | "changed" | "removed" | "unchanged";

/** One change the stepper steps to; the shape of @maxitor/panel's ChangeEntry. */
export type NoteStep = { key: string; title: string; detail?: string; status: Exclude<NoteChange, "unchanged">; group: string };

/** A note's first words, as a list names it. */
export function snippet(body: string, length = 60): string {
  const line = body.replace(/\s+/g, " ").trim();
  return line.length > length ? `${line.slice(0, length - 1)}…` : line;
}

/**
 * The notes shown at this page's moment compared with the other moment: Diff (`side` null) is B against A and draws
 * what B lost as removed ghosts; Side by side's A marks what B does not have as removed, B what A did not have as
 * added. Without the other moment nothing is compared. `arrival` says what a note the other moment lacks stands for —
 * a draft's change is what its own state says: new, changed or deleted.
 */
export function compareNotes<Note extends ComparedNote>(
  shown: readonly Note[],
  other: readonly Note[] | null,
  side: "a" | "b" | null,
  arrival?: (note: Note) => NoteStep["status"],
): {
  status: Map<string, NoteChange>;
  ghosts: Note[];
  steps: NoteStep[];
} {
  const status = new Map<string, NoteChange>();
  if (other === null) return { status, ghosts: [], steps: [] };
  const before = new Map(other.map((note) => [note.id, note]));
  for (const note of shown) {
    const was = before.get(note.id);
    // A note the other moment lacks is added — removed on A's side —, unless the page says what its arrival is.
    status.set(note.id, !was ? (arrival?.(note) ?? (side === "a" ? "removed" : "added")) : was.body !== note.body ? "changed" : "unchanged");
  }
  const ghosts = side === null ? other.filter((note) => !status.has(note.id)) : [];
  for (const note of ghosts) status.set(note.id, "removed");
  const steps = [...shown, ...ghosts]
    .filter((note) => status.get(note.id) !== "unchanged")
    .map((note) => ({ key: `note:${note.id}`, title: snippet(note.body), status: status.get(note.id) as NoteStep["status"], group: note.writer_name }))
    .sort((a, b) => (a.group < b.group ? -1 : a.group > b.group ? 1 : 0));
  return { status, ghosts, steps };
}
