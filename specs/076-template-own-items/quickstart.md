# Quickstart: checking the template's items

## The template's tests

```bash
cd /Users/bystrovmaxim/PythonDev/gnomon/packages/maxitor-plugin-template && uv run pytest -q
```

Expected: every test passes, among them the items' actions, the list in parts, the key from a note to its item and the navigation.

## The plugin's check

```bash
cd /Users/bystrovmaxim/PythonDev/gnomon && uv run maxitor-plugin-check packages/maxitor-plugin-template
```

Expected: no problem; the navigation holds no `core:item`.

## Through the gateway on the local stand

With the stand of bystrovmaxim/gnomon#75 running and a member signed in to organization `acme`:

1. `POST /p/notes/api/acme/items {"title": "Payment service"}` → `200` with `item_id`.
2. `GET /p/notes/api/acme/lists/list_items` → one entry `{"key": <item_id>, "title": "Payment service", "icon": "folder"}`.
3. `PATCH /p/notes/api/acme/items {"item_id": …, "title": "Payments", "base_moment": …}` → `200`; the list now reads "Payments", and at a moment before reads "Payment service".
4. `POST /p/notes/api/acme/notes {"item_id": <a random uuid>, "body": "x"}` → `403`.

## The documentation

```bash
cd /Users/bystrovmaxim/PythonDev/gnomon && grep -rn -i "catalog item\|core:item" docs/plugins packages/maxitor-plugin-template --exclude-dir=node_modules
```

Expected: no line.
