# gnomon

A gnomon is the part of a sundial that casts the shadow: it shows what is already there. This repository holds two things that do the same for a software system.

- **[Open Gnomon Protocol](packages/open-gnomon-protocol/README.md)** — the language of a system's graph: its domains, actions, entities, resources and the links between them. It is a set of JSON schemas with no code, and any programming language can write it.
- **[Maxitor](packages/maxitor/README.md)** — the IDP that reads any graph written in that language and draws it: diagrams, comparison of versions, rooms, and the catalog of a whole enterprise. It comes with its tools:
  - `graph-builder` — builds a project's graphs with the project's own command, checks them against the protocol and keeps the files current in CI;
  - `repo-graph-port` — serves a graph's history from its repository.

[AOA](https://github.com/bystrovmaxim/aoa), a Python framework, is one producer of the protocol's graph. Maxitor and its tools are built on AOA; this repository takes it as the git submodule `external/aoa`, fixed to one commit.

How-to guides are in [docs/](docs/README.md).

## Get started

```bash
git clone --recurse-submodules https://github.com/bystrovmaxim/gnomon.git
cd gnomon
uv sync --all-extras
uv run --extra dev task maxitor
```

Open `http://127.0.0.1:8000` and point it at a service's graph.

To move AOA to a newer commit: `./update-aoa.sh [<ref>]`, then commit the submodule and `uv.lock` together.

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
