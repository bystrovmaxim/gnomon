# maxitor-plugin-sdk

What a Maxitor plugin and Maxitor itself share.

| Module | What it holds |
|---|---|
| `maxitor_plugin_sdk.schemas` | The JSON schemas of a plugin's files: the passport `maxitor-plugin.yaml` (format 3: the frontend as sources in `frontend.source`; format 2 and `frontend.build` are refused by name), `navigation.yaml` (format 4: the tree and the way each node opens; format 2 and a node declaring `history`, `room` or `controls` are refused by name, and so is a node with children and no `opens`, or a node without children that says it, the node named) and `foreign-keys.yaml`; the history a page's actions answer the time scale, `history-2.schema.json` (format 2: milestones of the kinds a page declares, a card of blocks). |
| `maxitor_plugin_sdk.checks` | One plugin's files against their schemas, and the rules across fields a schema cannot express. |
| `maxitor_plugin_sdk.compat` | Whether plugins fit a core and each other. It is the only code that decides it. |
| `maxitor_plugin_sdk.roles` | The core's roles a plugin's actions check: `MemberRole`, `AdministratorRole`, `ServiceRole`, and `CORE_ROLES` for a token coordinator's registry. A plugin declares no roles of its own; the check refuses a passport with `roles` and a node asking for anything but `member` or `administrator`. |

## Checking one plugin's files

```bash
maxitor-plugin-check path/to/plugin
```

It prints each problem and exits with 1, or prints nothing and exits with 0.

## Deciding compatibility

`decide(core, plugins)` decides a set of plugins against a core. `decide_change(core, installed, change)` decides one installation, upgrade or removal against the plugins already installed. Both answer a list of refusals, empty when everything fits. Each refusal has a kind, the sides it involves, and a sentence:

| Kind | When |
|---|---|
| `format` | A plugin writes a file in a format the core does not read. |
| `core_range` | The core's version is outside the plugin's `requires.maxitor`. |
| `two_versions` | Two versions of one plugin in one installation. |
| `cycle` | Plugins depend on each other in a circle. |
| `sdk_major` | The plugin is built with another major version of this SDK than the core. |
| `dependency` | A plugin needs another that is missing or of a version outside its range; after an upgrade or a removal the refusal also names the change. |

A core describes itself with its passport, `GET /api/v1/core/passport`; a plugin with `maxitor-plugin.yaml`. `maxitor plugin check <path> --core <version>` puts both together.
