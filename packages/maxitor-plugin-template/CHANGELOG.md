# Changelog

All notable changes to the Maxitor plugin template are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-11-09

### Added

- **The plugin `notes`**, a small plugin with every part a Maxitor plugin has: a passport, tree nodes with their controls and room behaviour, cross-plugin foreign keys declared by names alone, a migration creating `note` and `note_versions` by versioned storage, an AOA backend and Next.js pages that keep every view setting in their address.
- **The backend** writes a note and its version in one transaction under the organization's lock, reads only version tables at one moment, accepts only the core's EdDSA token issued for this plugin, takes the organization from the address and checks membership in it before touching its data.
- **The checks** Maxitor's installer makes on a plugin's own files: JSON schemas of the passport, `navigation.yaml` and `foreign-keys.yaml`, and the rules across fields — the version equals the package's, no dependency cycle, unique node ids and addresses, path parameters defined above their node, controls on parameters of their own.
- **The documentation** of the plugin concept and of versioned storage, in `docs/`.
