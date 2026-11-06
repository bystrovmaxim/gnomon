# Data model: protocol 1.7

1.7 = 1.6 + one node type + one edge type. No other node type, node property or edge changes.

| Node | `properties` |
|---|---|
| `DataSource` | `description` (string, required); nothing else |

| Edge | From | To | `relationship` | `is_dag` | `properties` |
|---|---|---|---|---|---|
| `resource_data_source` | `Resource` | `DataSource` | `Aggregation` | `true` | `{}` |
| `application` (from 1.0) | `DataSource` | `Application` | `Aggregation` | `true` | `{}` |

```json
{"id": "shop.ShopDataSource", "type": "DataSource", "label": "ShopDataSource", "properties": {"description": "Main shop database"}}
{"id": "shop.ShopDataSource|application|shop.Application", "source_id": "shop.ShopDataSource", "target_id": "shop.Application", "type": "application", "relationship": "Aggregation", "is_dag": true, "properties": {}}
{"id": "shop.OrdersResource|resource_data_source|shop.ShopDataSource", "source_id": "shop.OrdersResource", "target_id": "shop.ShopDataSource", "type": "resource_data_source", "relationship": "Aggregation", "is_dag": true, "properties": {}}
```

## What the schema checks, and what only the producer can

| Rule | Schema 1.7 | Producer (AOA) |
|---|---|---|
| A `DataSource` node has `label` and a string `description`, and no other property | ✓ | ✓ |
| A `resource_data_source` edge is an `Aggregation`, `is_dag` `true`, with empty `properties` | ✓ | ✓ |
| The edge runs from a `Resource` to a `DataSource` | — | ✓ |
| A resource has at most one `resource_data_source` edge | — | ✓ |
| A `DataSource` has exactly one `application` edge, to the `Application` node | — | ✓ |
| A `DataSource` has at least one resource | — | ✓ |
| Relations stay inside one boundary (the data source, or the resource without one) | — | ✓ |
