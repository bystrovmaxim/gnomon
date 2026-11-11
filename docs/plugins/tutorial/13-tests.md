# 13. Tests

**Builds on**: chapters 3–6. Every later chapter adds what its part must prove.

A plugin's tests run without a database: the template's recording connection records every statement and answers from a script, so a test reads the SQL a method writes.

What a plugin must prove so far:

1. **Every reading reads at a moment and in one organization.** `test_reading_sql.py` reads the SQL of every reading method and refuses one without the moment condition or the organization.
2. **The past never changes.** `test_notes_changes.py` writes, edits and deletes, and reads each moment between them.
3. **A conflict loses nothing.** An edit with an old `base_moment` writes nothing and names who changed the note.
4. **Only the core's token for this plugin passes.** `test_app.py` sends a token for another plugin, one signed with another key and one with the role `service`, and gets 403 for each:

<!-- quote: packages/maxitor-plugin-template/tests/test_app.py -->
```python
        assert call("io.github.acme.tags", ["member"]) == 403
        assert call("io.github.bystrovmaxim.notes", ["member"], Ed25519PrivateKey.generate()) == 403
        # The plugin itself, with no person, is not a member: its role does not open a person's page.
        assert call("io.github.bystrovmaxim.notes", ["service"]) == 403
        # A member passes the role; the organization's decision reads the core's tables, empty here: not found.
        assert call("io.github.bystrovmaxim.notes", ["member"]) == 404
```

## Run them

```bash
uv run --extra dev pytest packages/maxitor-plugin-template/tests -q
```

```text
193 passed
```
