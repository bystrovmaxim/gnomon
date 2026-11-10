# Quickstart: checking the template's history

All from the repository's root; no database is needed.

1. The SDK's tests — the moment condition, the bars, the history declarations and their check:

   ```bash
   uv run pytest packages/maxitor-plugin-sdk/tests
   ```

2. The template's tests — reading at moments, editing and its conflicts, deleting, revisions, the draft, the milestones and cards, the SQL of every reading action:

   ```bash
   uv run pytest packages/maxitor-plugin-template/tests
   ```

3. The template against the contract:

   ```bash
   cd packages/maxitor-plugin-template && uv run maxitor-plugin-check .
   ```

   Expected: no output, exit 0. Widen the Draft page's `compare` in `navigation.yaml` and run again: the check names the page and the comparison.

4. The documentation: `docs/plugins/concept.md` and `docs/plugins/versioned-storage.md` open from `docs/README.md`; `git grep -n "maxitor-plugin-template/docs/"` finds nothing outside `specs/` and changelogs.
