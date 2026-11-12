# 13. Tests

**Builds on**: chapters 3–6. Every later chapter adds what its part must prove.

A plugin's tests run without a database: the template's recording connection records every statement and answers from a script, so a test reads the SQL a method writes.

What a plugin must prove so far:

1. **Every reading reads at a moment and in one organization.** `test_reading_sql.py` reads the SQL of every reading method and refuses one without the moment condition or the organization.
2. **A draft is one person's, and the past never changes.** `test_notes_changes.py` writes a change, keeps its base through a second edit, reverts it and reads the draft at a moment; the query names the person, so nobody else's change is read. `test_revisions.py` reads Published at a past moment from the revision in force then.
3. **A conflict loses nothing, and it is found by value.** `test_draft_rules.py` decides every state against the published note: a change over the published text applies, one over another text is a conflict with both sides, and a change whose own text was published has nothing left to do; `test_revisions.py` publishes with the conflict list, an overwrite, a given-up change and a restored note, and refuses an empty draft in words.
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

11. **Its pages work now, by the rules of the draft.** `web/tests/draft.test.ts` proves that the State filter keeps what it chooses and fades a state with nothing behind it, that the change made last stands first, that only a change meeting someone else's publication is a conflict and its choice says what it does, and that Published marks the state each note waits in; `web/tests/notes.test.ts` proves the refusals' words. The core's browser check walks 1.6 on the stand: the draft is private until published, the states and reverts, publishing as one revision with its release, Published's marks and Edit in the draft, the State and Authors filters, on a desktop and at 375 px.
12. **Its history keeps its promises, and a rollback loses nothing.** `test_history_data.py` validates the milestones and cards against `history-2.schema.json` — the kinds `published` and `rollback`, one size, no flag — and reads the setups each page gives; `test_revisions.py` rolls back to a past revision as a new one naming it, opens again a note the item no longer publishes, touches no draft and no revision between, and refuses a revision that is not older than the one in force; `web/tests/compare.test.ts` compares the notes at two moments for Diff and for each side of Side by side. The core's browser check walks the scale on Published: two purple publications, Roll back exactly on v1, and a red v3 after them.

```bash
node --experimental-strip-types --test packages/maxitor-plugin-template/web/tests/*.test.ts
```

## Run them

```bash
uv run --extra dev pytest packages/maxitor-plugin-template/tests -q
```

```text
267 passed
```
