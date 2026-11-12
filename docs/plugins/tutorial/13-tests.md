# 13. Tests

**Builds on**: chapters 3–6. Every later chapter adds what its part must prove.

A plugin's tests run without a database: the template's recording connection records every statement and answers from a script, so a test reads the SQL a method writes.

What a plugin must prove so far:

1. **Every reading reads at a moment and in one organization.** `test_reading_sql.py` reads the SQL of every reading method and refuses one without the moment condition or the organization.
2. **The past never changes.** `test_notes_changes.py` writes, edits and deletes, and reads each moment between them.
3. **A conflict loses nothing.** An edit with an old `base_moment` writes nothing and names who changed the note.
4. **A note stands only on an item of its organization.** `test_items.py` writes a note, a revision and a rename on an item that does not exist and on another organization's, and each is refused before anything is written; a title another item has is refused only after the organization's lock.
5. **Only the core's token for this plugin passes.** `test_app.py` sends a token for another plugin, one signed with another key and one with the role `service`, and gets 403 for each:

<!-- quote: packages/maxitor-plugin-template/tests/test_app.py -->
```python
        assert call("io.github.acme.tags", ["member"]) == 403
        assert call("io.github.bystrovmaxim.notes", ["member"], Ed25519PrivateKey.generate()) == 403
        # The plugin itself, with no person, is not a member: its role does not open a person's page.
        assert call("io.github.bystrovmaxim.notes", ["service"]) == 403
        # A member passes the role; the organization's decision reads the core's tables, empty here: not found.
        assert call("io.github.bystrovmaxim.notes", ["member"]) == 404
```

6. **Its place in the tree holds.** `test_navigation.py` runs Maxitor's own check of `navigation.yaml` on a copy of the plugin: the template passes, and every fault of chapter 7 — a list reading an action the plugin does not have, a parameter no list node above defines — is refused with its reason.
7. **Its pages lie in the shell.** `test_shell.py` runs the same check over the copy's pages: the template's pass, and a page that steps out of the shell of `@maxitor/panel` is refused by its file and line:

<!-- quote: packages/maxitor-plugin-template/tests/test_shell.py -->
```python
def test_a_page_that_places_an_element_fixed_is_refused(plugin) -> None:
    page = _with_web(plugin) / NOTES_PAGE
    page.write_text(page.read_text(encoding="utf-8") + 'const banner = { position: "fixed" };\n', encoding="utf-8")
    assert any("an element placed fixed lies over Maxitor's frame" in problem for problem in check_plugin(plugin))
```

8. **Its frontend builds the way Maxitor builds it.** `maxitor plugin build` runs the installer's own step: the core's `@maxitor/panel` in place of the plugin's, only packages on the core's npm list, no network while the plugin's code runs. The plugin's CI runs it with the core at the lower and at the upper bound of `requires.maxitor`; the template's CI does both — the check run with the checkout's core, the job `template-lower-bound` with the newest release of the lowest minor the range allows:

```bash
uv run --all-extras maxitor plugin build packages/maxitor-plugin-template --core 4.7.0
```

9. **Its filters read the address the way the shell writes it.** A range of dates is `from..to` with bounds that may move with today; a test of the page's filtering reads `?written=now-30d..now` on a fixed day and expects exactly the notes of those 30 days, and a note with no date only while both ends are open — `inRange` of `@maxitor/panel` gives the same answer the core's test list relies on:

```ts
import { inRange, readRange } from "@maxitor/panel";
assert.equal(inRange("2026-09-01", readRange("now-90d..now"), "2026-11-10"), true);
```

10. **Its pages give their history, and its tree holds nothing else.** `test_history_data.py` reads the history each page gives in its code and the passport's comparisons; `test_navigation.py` adds `history` or `room` to a page's node and sees it refused by name.

## Run them

```bash
uv run --extra dev pytest packages/maxitor-plugin-template/tests -q
```

```text
232 passed
```
