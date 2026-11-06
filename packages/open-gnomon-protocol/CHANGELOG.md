# Changelog — Open Gnomon Protocol

A version of the protocol is a schema file in [graph/](graph/) that never changes once published. A release is the git tag `open-gnomon-protocol-v<version>`.

## 1.8 — 2026-11-06 18:23

The data model is logical. A relation between entities says that they are related and promises no foreign key, no join and no shared transaction, so from 1.8 a relation, a reference, a specialization, a parent entity and a lifecycle's state type may join entities of any resources and data sources. In exchange every stored entity has a physical place: a resource that stores an entity names exactly one data source, and a domain reaches a data source through one resource, while a data source serves resources of several domains, one each. A data source is any store — a database, an external service, an in-memory store. The vocabulary is that of 1.7, and so is the schema under its new version: every new rule joins several rows, and the README now states the division of checks as a rule of the protocol — the schema checks everything one row shows, the producer keeps every rule across rows and checks it when it builds the model and the graph. Schema: [graph/1.8.json](graph/1.8.json).

## 1.7 — 2026-11-06 14:03

A document can say which resources share a store: the node type `DataSource` is one database or other store, with its `description`, and the edge `resource_data_source` goes from a `Resource` to it, as an `Aggregation` with `is_dag` `true` and no properties. A data source belongs to the application, by the `application` edge a domain and a role have, and to no domain. It is optional: a resource has at most one, and a resource with none works on its own, as before. The schema checks the shape of each new row; the rest — at most one data source per resource, the ends of the edge, one `application` edge per data source, relations kept inside one data source — the producer keeps, and the README lists each rule. Nothing earlier changes, so a 1.6 document becomes a 1.7 one by changing its `schema_version`. Schema: [graph/1.7.json](graph/1.7.json).

## 1.6 — 2026-11-05 22:33

A document can say where each entity is stored: the edge `entity_resource` goes from an `Entity` to the `Resource` that stores it, as an `Aggregation` with `is_dag` `true` and no properties, and every entity has exactly one. A schema cannot count edges, so the producer keeps that rule. The entity keeps its `domain` edge, so a 1.5 reader still finds every entity in its domain. Nothing earlier changes, so a 1.5 document becomes a 1.6 one by changing its `schema_version` and adding the edges. The schema's `$id` is its address in this repository. Schema: [graph/1.6.json](graph/1.6.json).

## 1.5

A document can say that an action caches its Result entity by entity: a `Cache` node may have the kind `entity_key` — the declaration that builds the key of one entity — and the edge `@cache_entity_key` goes from the action to it. Nothing earlier changes, so a 1.4 document becomes a 1.5 one by changing its `schema_version`. Schema: [graph/1.5.json](graph/1.5.json).

## 1.4

A document can say what a service caches: the node type `Cache`, one per cache declaration of an action, with its `kind` and `description`; the edges `@cache_key`, `@cache_read`, `@cache_write` and `@cache_invalidate` from an action to its declarations; and `caches` and `invalidates` from an action to the entity types its cache entries are tagged with and the ones it drops. Nothing earlier changes, so a 1.3 document becomes a 1.4 one by changing its `schema_version`. Schema: [graph/1.4.json](graph/1.4.json).

## 1.3

A document can say what a service publishes: the node type `Event`, with its fields as `Field` nodes, the edge `@emits` from a method to an event it may publish, the edge `domain_event` from a domain to an event of its vocabulary, and `typed_events` on every `Domain`. `typed_events` is required, so a 1.2 document does not become a 1.3 one by changing its `schema_version`. Schema: [graph/1.3.json](graph/1.3.json).

## 1.2

An entity field, a lifecycle, a role and a `@connection` link may carry their `description`, so a reader can show what the model declares without the model. All four are optional: a 1.1 document becomes a 1.2 one by changing its `schema_version`. Schema: [graph/1.2.json](graph/1.2.json).

## 1.1

Every edge has an `id`, unique among the edges, so two revisions of a graph compare edge by edge. Schema: [graph/1.1.json](graph/1.1.json).

## 1.0

The first shape: a document with `schema_version`, `nodes` and `edges`; every node has an `id`, edges do not. Schema: [graph/1.0.json](graph/1.0.json).
