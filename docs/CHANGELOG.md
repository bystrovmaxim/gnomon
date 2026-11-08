# Changelog

## [2026-11-09] — How a Maxitor plugin is made, shown by one that is

Maxitor is going to host plugins: independent applications that install into it, keep their data in its database and show their pages inside its screen. Before the first of them is written, the rules they follow are written down and shown working in a new package, `packages/maxitor-plugin-template` — a small plugin, `notes`, that keeps notes on catalog items and has every part a real plugin has.

Its documentation lies beside it. [plugins.md](../packages/maxitor-plugin-template/docs/plugins.md) is the plugin concept: the passport a plugin declares itself by; how it depends on the core and on other plugins by version ranges, as pip requirements do, with the core as one more node of that graph and one function deciding compatibility everywhere; its own schema and database role, writing only its own tables and reading all others; foreign keys across plugins, declared by names alone and built by the installer, so nothing in the file can become SQL; one sign-in through the core's gateway, with a short token signed by the core for each plugin; the screen the core draws and the plugin only fills — the left tree it adds its nodes to, the right panel, one canvas, the controls over it — and an address that holds everything a person sees, the organization first, so Back, a link and a room work for every plugin alike. [versioned-storage.md](../packages/maxitor-plugin-template/docs/versioned-storage.md) says how tables, versions and time are kept so that any past moment reads by the same actions as the present.

The plugin itself follows them: its passport, its tree nodes and controls, its declared foreign keys and its first migration pass the checks the installer will make, kept in the package until `maxitor-plugin-sdk` takes them; its backend writes a note and its version in one transaction under the organization's lock, reads only version tables at one moment, accepts only the core's token issued for it, and touches an organization's data only for a member of it; its Next.js pages keep every view setting in their address. It does not run against Maxitor yet — the core that hosts it is the work of bystrovmaxim/gnomon#72 — and until then it runs in its tests.

## [2026-11-05] — The published wheel is checked before it goes out

Every pull request now builds the `maxitor` wheel and installs it into a clean environment, the way a user gets it from PyPI. It must ship only Maxitor's own code, install the `graph-builder` command without bringing AOA or any of the web part's libraries, and answer `maxitor` and `repo-graph-port` with the extra to install when that extra is missing. These checks lived in AOA's repository before the move and now run here, where the wheel is built and published.

## [2026-11-05] — Maxitor and the Open Gnomon Protocol have a home of their own

Maxitor used to live inside the AOA repository, next to the framework, and every change to AOA paid for Maxitor's checks — a pull request with no line of code still waited for its client to be drawn in three browsers. The two are different things: AOA is a Python framework, one of the programs that write a system's graph, while the Open Gnomon Protocol is the graph's language, which any program can write, and Maxitor reads any graph written in it.

This repository is now their home. Their whole history came with them, so `git log` and `git blame` on any file go back to its first commit, through every rename; issue numbers in old commit messages point to AOA's issues, where that work was done. The specs of Maxitor's work, its how-to guides and the Russian drafts beside them came too.

AOA is taken as a git submodule at `external/aoa`, fixed to one commit: Maxitor builds with exactly that AOA, and a newer one arrives only when `./update-aoa.sh` moves it, in a commit of its own. Clone with `git clone --recurse-submodules`.

For someone who uses Maxitor, nothing changes but the addresses. `pip install maxitor` installs the same package with the same commands. A project that checks its graphs in CI writes `uses: bystrovmaxim/gnomon/packages/maxitor/tools/graph-builder@maxitor-v<version>` instead of the old path under `bystrovmaxim/aoa`. Releases are published from here to PyPI by a trusted publisher, so no token is kept in the repository.

Each pull request here runs the same check run as before — the static checks, the tests of every part, the client's build and tests, the graph files and the versions — and the browser checks run locally with `bash scripts/check_before_pr.sh`, which leaves the status the merge rule of `main` requires.
