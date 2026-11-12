# Contract: plugin passport format 3

`maxitor-plugin.yaml` of format 3 is format 2 with one change in `frontend`:

```yaml
passport: 3
frontend:
  # The frontend's sources in the wheel: package.json, package-lock.json and the pages. The core builds them.
  source: maxitor_notes/web
  navigation: maxitor_notes/navigation.yaml
```

- `frontend.source` is required when the plugin has pages; it names a folder of the wheel holding `package.json` and `package-lock.json`.
- `frontend.build` is not a field of format 3.
- The core's passport (`maxitor-core.yaml`) reads `plugin-passport: [3]`; a wheel of format 2 is refused: `the passport is format 2; the core <version> reads format 3 — the frontend ships as sources (frontend.source)`.
- The wheel carries the sources without `node_modules`, `.next` and any built site.
