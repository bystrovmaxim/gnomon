# Data model: protocol 1.6

1.6 = 1.5 + one edge type. No node type, node property or other edge changes.

| Edge | From | To | `relationship` | `is_dag` | `properties` | Rule (README, kept by the exporter) |
|---|---|---|---|---|---|---|
| `entity_resource` | `Entity` | `Resource` | `Aggregation` | `true` | `{}` | every `Entity` has exactly one |

Unchanged and kept beside it: `domain` (Entity → Domain) and `domain` (Resource → Domain).

The edge row, as every row, has `id`, `source_id`, `target_id`, `type`, `relationship`, `is_dag`, `properties`:

```json
{"id": "shop.SalesOrderCoreEntity|entity_resource|shop.StorefrontDatabase",
 "source_id": "shop.SalesOrderCoreEntity", "target_id": "shop.StorefrontDatabase",
 "type": "entity_resource", "relationship": "Aggregation", "is_dag": true, "properties": {}}
```

What schema 1.6 refuses for this edge: a property; a `relationship` other than `Aggregation`; `is_dag` `false`. What it passes (README rule): zero or two such edges on an entity; ends that are not an Entity and a Resource.
