// The template's history for the core's time scale (spec 079, history format 2): the kinds of its points — a
// publication, and a rollback that brought an earlier one back —, one size and no flags, so the legend speaks of
// those two alone. Published gives it with its milestones and their cards.
import type { Kind, PageHistory } from "@maxitor/panel";

export const NOTE_KINDS: Record<string, Kind> = {
  published: { tone: "purple", look: "filled", lead: "solid", term: "Published", def: "The notes as they were published, in force until the next publication." },
  rollback: {
    tone: "red",
    look: "filled",
    lead: "solid",
    term: "Rolled back",
    def: "A publication that brought back the notes of an earlier one; everything published between them stays in the history.",
  },
};

/** Published on the scale: the bars of its notes' changes, its publications as points with their cards, and Roll back
    offered exactly on a past publication. */
export const PUBLISHED_HISTORY: PageHistory = {
  read: "list_published_notes",
  milestones: "list_note_history",
  card: "note_milestone_card",
  kinds: NOTE_KINDS,
  actions: [{ on: "milestone", kinds: ["published", "rollback"], title: "Roll back to {ref}", action: "rollback_publication", ask: true }],
};

/** Draft on the scale: the bars of the person's own changes, the same publications, and both comparisons of the passport. */
export const DRAFT_HISTORY: PageHistory = { read: "list_note_draft", milestones: "list_note_history", card: "note_milestone_card", kinds: NOTE_KINDS };
