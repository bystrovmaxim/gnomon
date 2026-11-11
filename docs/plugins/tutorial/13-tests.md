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

6. **Its place in the tree holds.** `test_navigation.py` and `test_controls.py` run Maxitor's own check of `navigation.yaml` on a copy of the plugin: the template passes, and every fault of chapter 7 — a list or a filter reading an action the plugin does not have, a parameter no list node above defines, a control on `at` or on a parameter of the path — is refused with its reason. A test that adds a source gives the copy its action file first:

<!-- quote: packages/maxitor-plugin-template/tests/test_controls.py -->
```python
def test_a_mode_pill_with_counts_passes(plugin, edit, action) -> None:
    action("count_notes_by_mode")
    edit("navigation.yaml", lambda doc: _controls(doc).update(mode=MODE))
    assert check_plugin(plugin) == []
```

## Run them

```bash
uv run --extra dev pytest packages/maxitor-plugin-template/tests -q
```

```text
245 passed
```
