# ErdFilterPanel


<p align="center">
  <a href="https://github.com/bystrovmaxim/gnomon"><img src="https://img.shields.io/badge/license-Apache_2.0-blue" alt="Apache-2.0"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white" alt="React 19"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="../../../../README.md"><img src="https://img.shields.io/badge/docs-Maxitor%20client-blue" alt="Maxitor client"></a>
</p>

**Role:** The ERD's one filter panel. Its sections — **Domains**, **Kinds**, **Resources** and, in Diff, **Changes** — behave as a strict accordion: exactly one is open at a time (the section that paints when the diagram mounts, else Domains), opening one folds the others, and clicking the open header folds it. Moving the gear shift opens the section it paints by and folds the others; opening a section by hand leaves the paint alone. Rows use the same chrome as `DomainLegend` (shared `floatingLegend*` styles from `@/lib/ui`): a 20 px disk and a label, dimmed when switched off.

- **Width:** fixed at 148 px (`ERD_FILTER_PANEL_WIDTH`, the width the production Domains legend had); the panel never widens. A label that does not fit is cut with an ellipsis and shows its full text in a tooltip — only when it was actually cut.
- **Height:** the panel ends above the zoom toolbar and scrolls inside itself; wheel events stop at the panel, so scrolling it never zooms or pans the canvas.
- **A page's own sections:** given `sections` (`{ id, title, rows, paints }`) and `onToggleRow(section, row)`, the panel shows those instead of Domains, Kinds and Changes, in their order, and the gear shift has a point for each one that paints. The events explorer uses this: its sections come and go with what is on its screen (spec 055).
- **Kinds:** the section is rendered only when the graph has more than one kind. Rows come from `GET /api/v1/list-entity-kinds`, labelled with the kind's display name.
- **Resources** (spec 061): one row per resource that stores a table of the diagram, rendered even for one and absent on a graph older than protocol 1.6. It paints, so the gear shift has a point for it, after Kinds. A row's `hint` — the resource's full id — is its tooltip, whether or not the name was cut.
- **Narrow screens:** the panel starts as a "Filter" pill; opened, it shows the sections straight away — the word "Filter" does not appear inside — with the close button at the end of the Domains header.

## Props

| Prop | Meaning |
|------|---------|
| `domainRows` | `ErdFilterRow[]` — one row per domain (or 1-hop qualifier): `key`, `label`, `iconSrc`, `on`. |
| `kindRows` | `ErdFilterRow[]` — one row per entity kind present in the graph. |
| `onToggleDomain` | Called with a domain row's `key` when it is clicked. |
| `onToggleKind` | Called with a kind row's `key` when it is clicked. |
| `resourceRows` | `ErdFilterRow[]` — one row per resource of the diagram; empty, no Resources section. |
| `onToggleResource` | Called with a resource row's `key` (the resource's id) when it is clicked. |

## Files

| File | Responsibility |
|------|----------------|
| `ErdFilterPanel.tsx` | The panel, its accordion sections, the rows and the cut-only tooltip. |
| `ErdFilterPanel.test.tsx` | Width, accordion, tooltip, Kinds and Resources visibility, the mobile pill, wheel isolation, the gear shift's points and a page's own sections. |
