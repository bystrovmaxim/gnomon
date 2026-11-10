# Changelog — maxitor-plugin-sdk

## 1.1.0 — 2026-11-10 04:30

A plugin declares its tables instead of writing SQL. `plugin-schema-1.schema.json` and `plugin_schema` read and check a plugin's `schema.yaml`: tables, columns with a type from a closed list and `nullable`, keys, indexes, tables of mechanics; an unsafe name or an unknown type is refused before any SQL exists. The plugin passport goes to format 2 (`plugin-passport-2.schema.json`): `backend.migrate` is gone and `database.schema` names `schema.yaml`; `checks` reads passport 2 and checks `schema.yaml`, and passport 1 is no longer read. `core_functions` builds the SQL that calls the core's functions for the change time, the watermark and membership. ([#82](https://github.com/bystrovmaxim/gnomon/issues/82))

## 1.0.0 — 2026-11-10

The first version of the SDK. It takes over from the plugin template the JSON schemas of a plugin's files and the checks of one plugin, so a plugin and Maxitor check the same way. It adds `compat`, the one place that decides whether plugins fit a core and each other: a file format the core does not read, a core outside a plugin's range, two versions of one plugin, a cycle, a plugin built with another major version of the SDK, and a dependency that is missing or broken by an upgrade or a removal. Every refusal names every side of the conflict. The plugin passport gains `sdk`, the major version of this SDK the plugin is built with.
