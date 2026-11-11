# Changelog — maxitor-plugin-sdk

## 1.4.0 — 2026-11-11

`checks` refuses a `navigation.yaml` whose list node, filter, legend or mode pill reads an action the plugin does not have: every `source` and `counts` names a file `actions/<name>_action.py` or `history/<name>_action.py`. `source_problems`, `named_actions` and `action_names` give the same check to the core. ([#74](https://github.com/bystrovmaxim/gnomon/issues/74))

## 1.3.0 — 2026-11-11

A plugin works with the core's roles as they are. `roles` gives `MemberRole` for every active user of the organization of the address, `AdministratorRole` for its administrators and `ServiceRole` for the plugin's own call with no person, and `CORE_ROLES` for a token coordinator's registry. `checks` refuses a passport that declares `roles` and a node of `navigation.yaml` that asks for anything but `member` or `administrator`. The SDK now needs `aoa-action-machine`. ([#75](https://github.com/bystrovmaxim/gnomon/issues/75))

## 1.2.0 — 2026-11-11

The history contract between a plugin and the core's time scale. `moments` writes the moment condition of versioned storage in its two forms — at a moment and over a stretch — and the moment's string form, so every reading query takes them from one place. `history.bars_of` turns the versions a page's own reading query finds over a stretch into bars of changes: added, changed, removed, as the versions themselves say. The passport gains an optional `history.compare` and each node of `navigation.yaml` an optional `history` (its comparisons, its reading action, bars, milestones and card); `history-1.schema.json` describes the context, bars, milestones and card that pass between the scale and a plugin; and `checks` refuses a page offering more comparisons than its passport or naming a history action the plugin's folder `history/` does not hold. ([#97](https://github.com/bystrovmaxim/gnomon/issues/97))

## 1.1.0 — 2026-11-10 04:30

A plugin declares its tables instead of writing SQL. `plugin-schema-1.schema.json` and `plugin_schema` read and check a plugin's `schema.yaml`: tables, columns with a type from a closed list and `nullable`, keys, indexes, tables of mechanics; an unsafe name or an unknown type is refused before any SQL exists. The plugin passport goes to format 2 (`plugin-passport-2.schema.json`): `backend.migrate` is gone and `database.schema` names `schema.yaml`; `checks` reads passport 2 and checks `schema.yaml`, and passport 1 is no longer read. `core_functions` builds the SQL that calls the core's functions for the change time, the watermark and membership. ([#82](https://github.com/bystrovmaxim/gnomon/issues/82))

## 1.0.0 — 2026-11-10

The first version of the SDK. It takes over from the plugin template the JSON schemas of a plugin's files and the checks of one plugin, so a plugin and Maxitor check the same way. It adds `compat`, the one place that decides whether plugins fit a core and each other: a file format the core does not read, a core outside a plugin's range, two versions of one plugin, a cycle, a plugin built with another major version of the SDK, and a dependency that is missing or broken by an upgrade or a removal. Every refusal names every side of the conflict. The plugin passport gains `sdk`, the major version of this SDK the plugin is built with.
