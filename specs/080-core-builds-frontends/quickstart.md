# Quickstart: checking that the core builds every plugin's frontend

Spec: [spec.md](spec.md) · Contracts: [build-step.md](contracts/build-step.md), [passport-3.md](contracts/passport-3.md).

## Prerequisites

- Docker on the host; the repository checked out; `uv sync`.
- The local stand: `scripts/core-stand.sh up` (the core, the gateway, the installer, the runner).

## 1. The author builds what the core will build

```bash
cd /Users/bystrovmaxim/PythonDev/gnomon
uv run maxitor plugin build packages/maxitor-plugin-template --core "$(uv run python -c 'import importlib.metadata as m; print(m.version("maxitor"))')"
```

Expected: the builder image is built once, then the template's image is named. With a type error added to a page: exit 1 and the first `Type error` line with its file.

## 2. The template is installed from its wheel and built by the installer

1. On the stand, in Settings → Plugins, install `notes` from its wheel.
2. Expected: the installer's log shows `FrontendBuiltEvent` for `notes`; the plugin turns enabled; its notes page opens.
3. Set `@maxitor/panel` in the template's `web/package.json` to an older version, rebuild the wheel, install it: the page still reports the core's library version.

## 3. A build that fails is refused by name

Install a copy of the template whose page has a type error: the install fails, Settings → Plugins shows the reason, the log has `FrontendBuildFailedEvent` with the plugin, its version and the error; nothing of it answers through the gateway.

## 4. An upgrade moves only when every build is ready

1. Raise the core's version in the checkout and restart the stand: the template keeps answering while the log shows its rebuild, then `FrontendGenerationMovedEvent`.
2. Repeat with a second plugin that fails to build: the log has `FrontendBuildFailedEvent` for it and no move; both plugins keep answering with the old builds.

## 5. Tests

```bash
uv run pytest packages/maxitor/maxitor-core/tests -k "frontend_build or plugin_build or generation" -q
uv run pytest packages/maxitor-plugin-sdk/tests -k "passport" -q
```
