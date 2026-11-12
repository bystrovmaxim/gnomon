# Data model: the time scale

One column is added to the template's table `revision`; everything else below is a shape that passes between the core, a page and a plugin's server.

## Table `revision` (the template)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `back_revision` | integer | yes | The number of the revision a rollback brings back; empty for a revision published from a draft. |

The column carries no `DEFAULT`; a publication from a draft writes it as null, a rollback as the number it brings back.

## Setup (a page's history, format 2)

| Field | Type | Rule |
|---|---|---|
| `read` | action name | optional; the page's reading action; bars come from it when `bars` is absent |
| `bars` | action name | optional; the plugin's own bars |
| `milestones` | action name | optional; the milestones in an interval |
| `card` | action name | optional; one milestone's card |
| `kinds` | map key → Kind | required when `milestones` is given; order is the legend's |
| `small` | string ≤ 160 | optional; present ⇒ milestones may be small |
| `flag` | string ≤ 160 | optional; present ⇒ milestones may carry a flag |
| `compare` | `diff` / `side_by_side` list | optional; narrows the passport's |
| `actions` | list of MilestoneAction | optional |

Every action name must be one of the plugin's; `compare` must narrow the passport's; a refused name is dropped and named.

## Kind

| Field | Type | Rule |
|---|---|---|
| `tone` | `neutral` `purple` `blue` `green` `amber` `red` | the core's palette |
| `look` | `filled` `hollow` `dashed` | |
| `lead` | `solid` `dashed` | the stretch of line leading to the point |
| `term` | string ≤ 40 | the legend's name |
| `def` | string ≤ 200 | the legend's sentence |

## MilestoneAction

| Field | Type | Rule |
|---|---|---|
| `on` | `milestone` | the only value |
| `kinds` | list of kind keys | the kinds it is offered on |
| `title` | string with `{ref}` | `Roll back to {ref}` |
| `action` | action name | one of the plugin's |
| `ask` | boolean | the page asks before calling |

## Milestone (format 2)

| Field | Type | Rule |
|---|---|---|
| `id` | string | unique in the page's history |
| `at` | moment | not later than the watermark |
| `ref` | string | short reference under the point |
| `title` | string | |
| `kind` | kind key | must be declared, else dropped and named |
| `small` | boolean | true only with `small` declared |
| `flag` | string | only with `flag` declared |
| `comment` | string | optional; under the scale |
| `link` / `opens` | page path | optional; `opens` for a milestone that is no state (an open pull request) |

## Context

| Field | Values |
|---|---|
| `at` | moment or null (now) |
| `against` | moment or null |
| `side` | `a`, `b` or null |
| `milestone` | the id `at` stands exactly on, or null |

## Anchor chain

A list of anchors, the deepest first: `["field:Account.email", "table:Account"]`, `["note:n2"]`, `["row:acc-06213"]`.

## Publication (the template's revision)

Its answers gain `back` — `back_revision` of the table. A rollback is a revision like any other; its notes are a copy of the notes the revision `back` held.
