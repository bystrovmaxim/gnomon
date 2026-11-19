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

It starts PostgreSQL in Docker, the core's backend, the plugin installer, the plugin runner and the core's application with the gateway on `http://localhost:3000`, and fills the marketplace with the template's wheel. The wheel carries the frontend's sources, not a built site: when you install Notes, the installer builds its frontend in the core's builder image with the core's own `@maxitor/panel` — the first time it also builds that image — and only then deploys it. [Run Maxitor core locally](../../how-to/run-the-core-locally.md) explains every step of it.

## Check it runs

Create an account, register an organization, install Notes in Settings → Plugins. Then, signed in, open `http://localhost:3000/p/notes/api/<your code>/items/00000000-0000-4000-8000-000000000001/notes`:

```text
{"notes":[],"bars":[]}
```

That answer came from the template's backend in its own container, through the gateway, with your sign-in.

A plugin is used by people, so give the organization a second one: Settings → Users → Invite, another email of yours. The letter lands in `.core-stand/outbox/` and holds no link; in a private window create an account with that email, and the screen of your organizations shows the invitation — Accept, and the second person is in. Settings → Users lists both of you; the second person's menu has "Invite to …" too, until Settings → Organization says administrators only. Chapters 9 and 11 look at what two people do to one draft and to published notes.

The installer's log shows the frontend's build before the deployment:

```text
The frontend of io.github.bystrovmaxim.notes 0.15.1 built for the core 4.12.1 as maxitor-plugin/notes_0_15_1-frontend:<sha12>-4.12.1
```

The versions in that example are the template and core used here; your log names the versions you built. The optional page-pill API in chapter 8 needs core 4.12.1 or later.

The next chapters build exactly that.
