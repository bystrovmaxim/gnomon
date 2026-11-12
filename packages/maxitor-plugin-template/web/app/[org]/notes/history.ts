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

/** Published on the scale: its publications as points, each with its card. */
export const PUBLISHED_HISTORY: PageHistory = { milestones: "list_note_history", card: "note_milestone_card", kinds: NOTE_KINDS };
