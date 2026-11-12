# Which version brings what

A plugin says the cores it runs with in `requires.maxitor` of its passport and is built with the core's `@maxitor/panel`; [the plugin concept](concept.md), section 3.3, explains the check. This page names the versions that bring the time scale and each of its parts, so an author knows the lower bound to write.

| Part | Brought by | What a plugin writes |
|---|---|---|
| The time scale: the pill, its card, a moment kept to the minute, "now" and the hatched future | Maxitor 4.11.0 | nothing: every page has it |
| History format 2: `kinds`, `small`, `flag`, `actions` | Maxitor 4.11.0, `maxitor-plugin-sdk` 1.9.0 (`history-2.schema.json`) | `history` in `PanelPage`; `requires.maxitor: ">=4.11,<5"` |
| Bars from the reading action over a stretch | Maxitor 4.11.0 | the reading action mounted at `history/<action>` |
| A card of blocks | Maxitor 4.11.0, `maxitor-plugin-sdk` 1.9.0 | the card action answers `{ blocks }` |
| Diff and Side by side, the page's context | Maxitor 4.11.0, `@maxitor/panel` 0.7.0 (`useMoment`) | `history.compare` in the passport |
| The halo and the fading | `@maxitor/panel` 0.7.0 (`marks.css`) | `data-change` on each element |
| `ChangeStepper`, `DiffCard`, `StatusIcon`, `VersionsBetween`, `useCounts` | `@maxitor/panel` 0.7.0 | the page draws them in a comparison |
| Track through anchors | Maxitor 4.11.0, `@maxitor/panel` 0.7.0 | `data-room-anchor` on what the page draws |
| An action on a milestone, `useBackToNow` | Maxitor 4.11.0, `@maxitor/panel` 0.7.0 | `actions` in the history and `onMilestoneAction` |

History format 1 — a milestone's closed `kind`, `minor`, `release`, the legend's words — is not read by Maxitor 4.11.0; `history-1.schema.json` left `maxitor-plugin-sdk` with 1.9.0. A plugin built for an earlier core keeps its pages and its moment, and its scale shows one moment with no points until it gives format 2.
