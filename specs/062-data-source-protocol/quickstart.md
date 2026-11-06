# Quickstart: check protocol 1.7

From the repository root.

1. The protocol file and its copy:

   ```bash
   uv run pytest tests/scripts/test_schema_copies.py -q
   ```

   Expected: every copy equals its source; 1.7 has its hash and the gnomon `$id`; 1.7 equals 1.6 but for its additions. Break: one character of the 1.7 `$id` → only the `$id` test fails; restore.

2. `graph-builder` reads 1.7:

   ```bash
   uv run graph-builder validate packages/maxitor/tools/graph-builder/tests/fixtures/graph-1.7.json
   ```

   Expected: `ok 1.7: <n> nodes, <m> edges`.

   ```bash
   uv run pytest packages/maxitor/tools/graph-builder/tests -q
   ```

   Break: `relationship` of `resource_data_source` set to `Composition` in `graph/1.7.json` → the tests of that value fail, no other; `description` of `DataSource` made optional → the test of the missing description fails, no other; restore.

3. The comparison reads 1.7:

   ```bash
   uv run pytest packages/maxitor/core/graph_compare/tests -q
   ```

   Break: drop `"1.7"` from `KNOWN_VERSIONS` → the 1.7 comparison test fails; restore.

4. Versions: CI's `version-gate` passes with protocol 1.7.0, `graph-builder` 1.5.0, `maxitor` 3.18.0.
