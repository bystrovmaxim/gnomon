# Working in this repository

## What lives here

- `packages/open-gnomon-protocol` — the graph's language: JSON schemas, one file per version, no code.
- `packages/maxitor` — Maxitor: the web part (`maxitor-web`), `graph-builder` and `repo-graph-port` (`tools/`), the code they share (`core/`) and the setup skill (`skills/`).
- `specs/` — the Spec Kit specs of this work; the older ones came from aoa with their history and keep their numbers.
- `external/aoa` — the AOA framework as a git submodule, fixed to one commit. It is not a package of this repository: nothing here edits it, and `./update-aoa.sh [<ref>]` moves it, in a commit of its own together with `uv.lock`.

## Where the governing text lives

`.specify/memory/constitution.md` is the binding text. It is the maintainer's: an agent writes in it only when the maintainer asks in the current turn. The house rules below apply alongside it.

## House rules

- **Nothing is committed, pushed, opened as a pull request or merged without an explicit instruction** from the maintainer in the current conversation. Prepare the change, show the diff, wait.
- **One phase = one commit.** An issue lists its phases as numbered checkboxes, ticked after each commit.
- **English wherever it is read as code or as history** — commit messages, issues, pull requests, review comments, and every comment, docstring or example in the code.
- **No tool attribution in history** — no "Generated with" footer and no `Co-Authored-By:` line for an agent, in any commit, pull request, issue or comment.
- **A pull request opens whole**: code, tests, rebuilt graph files, raised versions, documentation and the changelog are all on the branch before it opens. A draft is no exception.
- **The tail of a change is three steps, in this order**: the closing check run taken to zero, then the documentation, then the changelog. The changelog is one article about what the work created, in plain words.
- **A pull request into `main` raises the version of every level it changes.** A level is a folder with a `version.toml`; [version-gate](https://github.com/bystrovmaxim/version-gate) checks this in CI.
- **Every check runs once**: after each phase only the tests of that phase run; CI runs the closing check run on the pull request; the browser checks, which CI cannot run, run locally on a pushed commit.
- **Verification is adversarial**: break the code the way the new test must catch, confirm that test fails and no other test of the phase does, restore.
- **Russian drafts** (`*.ru_draft.md`) live beside their English pages and never enter a commit; `.gitignore` keeps them out.
- **A finished task is reported with examples**: what changed, the code before and after where it matters, one real call with the answer it gives, how it was verified, and what is left.
- **Documentation ships with the change** it describes.

## The workflow

Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` → `/speckit-converge`, with `/speckit-clarify`, `/speckit-checklist` and `/speckit-analyze` as quality gates.

## Where work is tracked

GitHub issues of this repository are the units of work; one branch per issue (`feature/issue-<n>-<slug>`), one pull request per branch.
