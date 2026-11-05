# Quickstart: checking that Maxitor shows the model of a resource

## Prerequisites

- `external/aoa` at `537c61d4` (`./update-aoa.sh 537c61d4`), `uv sync` done.
- A test graph of version 1.6, `tests/fixtures/resource_model.py`: domain `shop.ShopDomain`, resources `StorefrontDatabase` (entities `Order`, `OrderLine`, related) and `BillingDatabase` (entity `Invoice`), and one resource without entities (`SocketChannel`).

## Per phase (only that phase's tests)

| Phase | Run | Expect |
|---|---|---|
| 1. AOA, `NodeCoreEntity`, DuckDB | the test set of T007 in tasks.md | Maxitor's graph builds as 1.6 and opens in DuckDB; `NodeCoreEntity` has one `entity_resource` edge to `DuckDBGraphResource`; `entity_resource_edges` filled, empty on 1.5 |
| 2. Listing | `uv run pytest packages/maxitor/maxitor-web/tests -k "list_entities"` | listing rows carry `resource_id`/`resource_label`; `resources` sorted by id with palette colours; a 1.5 graph gives nulls and `[]` |
| 3. Card | `cd packages/maxitor/maxitor-web/client && npx vitest run src/lib/erdCard` | `Resource: BillingDatabase` on `Invoice`; no line without a resource; `old → new` in Diff |
| 4. ERD | `cd packages/maxitor/maxitor-web/client && npx vitest run src/lib src/components/ui/ErdFilterPanel src/components/diagrams/ErdViewer` | Resources section, Boundary clusters, paint by resource, `off_resources` in the address, the Diff rule |

## Adversarial checks (break, see the new test fail alone, restore)

1. Drop `"entity_resource"` from the simple edge map → the DuckDB test of a 1.6 graph fails.
2. Order resources by label instead of id → the colour test fails.
3. Assign colours from the resources of the domains asked for → the "same colour on one domain's ERD and on all domains" test fails.
4. Mark a table changed when its `entity_resource` edge is only added → the 1.5 → 1.6 Diff test fails.
5. Declare a table inside both its resource cluster and its specialization cluster → the DOT test of nesting fails.
6. Keep `disabled_resources` in `useState` instead of `usePageSetting` → the room test fails.
7. Build `resources` from the asked domains only → the colour step of the browser check fails.

## Browser checks (locally, on a pushed commit)

`scripts/check_before_pr.sh`: the three engines, with `client/scripts/check-erd-resources.ts` (tasks T027) among them:

1. Diagrams' ERD of Maxitor's own graph, Boundary on: `NodeCoreEntity` in a contour headed `DuckDBGraphResource`.
2. Two tabs in one room on the shop graph: switching `BillingDatabase` off, Boundary off, the paint moved to Resources reach the other tab; a third joining later opens with the same state; `BillingDatabase` has one colour in every tab, on a domain's ERD and on "ERD all domains".
3. A 1.5 graph from history: no Resources section, no Boundary switch; Diff of 1.5 → 1.6 marks no table changed by its resource.

## Closing check run

CI on the pull request, taken to zero.
