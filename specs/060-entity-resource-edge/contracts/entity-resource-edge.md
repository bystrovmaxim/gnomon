# Contract: `graph/1.6.json`

- Address and `$id`: `https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/graph/1.6.json`.
- `schema_version` const `"1.6"`.
- Every definition of `graph/1.5.json` is present and equal, except `$id` and the `schema_version` const.
- Added: `$defs.entity_resource` and its branch in `$defs.link.oneOf` — see [data-model.md](../data-model.md).
- A copy: `packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.6.json`, byte for byte.
- Consumers that copy it: bystrovmaxim/aoa#469 (byte for byte, compared with the published file).

## Readers in this repository

| Reader | What it does with 1.6 |
|---|---|
| `graph-builder validate / write / check` | checks a 1.6 document against the schema; `ok 1.6: <n> nodes, <m> edges` |
| `graph_compare.compare` | compares two documents of any known version, 1.6 included |
| `repo-graph-port` | reads 1.6 versions through `graph-builder`'s check |
