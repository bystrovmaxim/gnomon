# 1. What you will build

**Builds on**: nothing. **Next**: [2. A copy of the template](02-a-copy-of-the-template.md).

A Maxitor plugin is a Python package that installs into Maxitor. It keeps its data in its own schema of Maxitor's database, its backend answers through Maxitor's gateway with one sign-in, and Maxitor runs it in containers of its own. The core knows nothing of a plugin's code: it reads the plugin's passport and its declarations, and builds the rest.

You build "Notes": members of an organization add items, like folders, which the plugin keeps itself and shows in Maxitor's tree, write notes on an item, edit and delete them without losing someone else's change, publish them as numbered revisions, and read them as they were at any past moment. The template is that plugin already; you copy it and make it yours.

## What you need

- Python 3.12, [`uv`](https://docs.astral.sh/uv/), Node.js 22 and Docker;
- this repository's checkout, with its submodule: `git submodule update --init`.

## The local stand

```bash
./scripts/core-stand.sh up
```

It starts PostgreSQL in Docker, the core's backend, the plugin installer, the plugin runner and the core's application with the gateway on `http://localhost:3000`, and fills the marketplace with the template's wheel. [Run Maxitor core locally](../../how-to/run-the-core-locally.md) explains every step of it.

## Check it runs

Create an account, register an organization, install Notes in Settings → Plugins. Then, signed in, open `http://localhost:3000/p/notes/api/<your code>/items/00000000-0000-4000-8000-000000000001/notes`:

```text
{"notes":[],"bars":[]}
```

That answer came from the template's backend in its own container, through the gateway, with your sign-in. The next chapters build exactly that.
