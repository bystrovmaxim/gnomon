# Contract: the entity listing names resources

`ListEntitiesAction` (the ERD's listing, `api/erd` → `listEntities`) answers as today, with two additions. Nothing is removed or renamed, so a client that ignores them works as before.

## Entity row

Before (protocol 1.5 graph, and today):

```json
{ "id": "shop.Invoice", "label": "Invoice", "domain_qualname": "shop.BillingDomain", "entity_kind": "core", "fields": [] }
```

After (protocol 1.6 graph):

```json
{ "id": "shop.Invoice", "label": "Invoice", "domain_qualname": "shop.BillingDomain", "entity_kind": "core", "fields": [],
  "resource_id": "shop.BillingDatabase", "resource_label": "BillingDatabase" }
```

On a graph of 1.0–1.5 both fields are `null`.

## Resources of the graph

The answer gains, beside `domain_slices` and `relations`:

```json
"resources": [
  { "id": "shop.BillingDatabase",    "label": "BillingDatabase",    "color": "#1f77b4" },
  { "id": "shop.StorefrontDatabase", "label": "StorefrontDatabase", "color": "#ff7f0e" }
]
```

- Every resource of the graph that stores at least one entity, sorted by `id` — not only those of the domains asked for.
- `color` is taken from the domain palette by the row's place in this list, so the same graph gives the same colours to every caller.
- An empty list on a graph of 1.0–1.5.

## Schema

`list_entities_action_schema.py` declares both entity fields as `{"type": ["string", "null"]}` and `resources` as an array of objects with required `id`, `label`, `color`, `additionalProperties: false`.
