# Quickstart: check protocol 1.6

From the repository root.

1. The protocol file and its copy:

   ```bash
   uv run pytest tests/scripts/test_schema_copies.py -q
   ```

   Expected: every copy equals its source; 1.6 has its hash and the gnomon `$id`. Break: change one character of the copy → the copy test fails naming both files; restore.

2. `graph-builder` reads 1.6:

   ```bash
   uv run graph-builder validate packages/maxitor/tools/graph-builder/tests/fixtures/graph-1.6.json
   ```

   Expected: `ok 1.6: <n> nodes, <m> edges`. The same fixture with a property on its `entity_resource` edge → `refused: … edges/<i> …`.

   ```bash
   uv run pytest packages/maxitor/tools/graph-builder/tests -q
   ```

   Break: set the edge's `relationship` in `graph/1.6.json` to `Composition` → the 1.6 test fails, no other; restore.

3. The comparison reads 1.6:

   ```bash
   uv run pytest packages/maxitor/core/graph_compare/tests -q
   ```

   Break: drop `"1.6"` from `KNOWN_VERSIONS` → the 1.6 comparison test fails; restore.

4. Versions: CI's `version-gate` passes with protocol 1.6.0, `graph-builder` 1.4.0, `maxitor` 3.16.0.
