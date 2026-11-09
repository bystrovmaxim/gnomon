# Changelog — maxitor-plugin-sdk

## 1.0.0 — 2026-11-10

The first version of the SDK. It takes over from the plugin template the JSON schemas of a plugin's files and the checks of one plugin, so a plugin and Maxitor check the same way. It adds `compat`, the one place that decides whether plugins fit a core and each other: a file format the core does not read, a core outside a plugin's range, two versions of one plugin, a cycle, a plugin built with another major version of the SDK, and a dependency that is missing or broken by an upgrade or a removal. Every refusal names every side of the conflict. The plugin passport gains `sdk`, the major version of this SDK the plugin is built with.
