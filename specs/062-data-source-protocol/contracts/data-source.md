# Contract: `graph/1.7.json`

- Address and `$id`: `https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/graph/1.7.json`.
- `schema_version` const `"1.7"`.
- Every definition of `graph/1.6.json` is present and equal, except `$id`, the `schema_version` const, the last branch of `$defs.vertex.oneOf` and the last branch of `$defs.link.oneOf`.
- Added: `$defs.data_source` and its branch in `$defs.vertex.oneOf`; `$defs.resource_data_source` and its branch in `$defs.link.oneOf` — see [data-model.md](../data-model.md).
- A copy: `packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.7.json`, byte for byte.
- Consumers that copy it: bystrovmaxim/aoa#475 (byte for byte, compared with the published file).

## Readers in this repository

| Reader | What it does with 1.7 |
|---|---|
| `graph-builder validate / write / check` | checks a 1.7 document against the schema; `ok 1.7: <n> nodes, <m> edges` |
| `graph_compare.compare` | compares two documents of any known version, 1.7 included |
| `repo-graph-port` | reads 1.7 versions through `graph-builder`'s check |
| Maxitor's web part | not yet: #52 |
