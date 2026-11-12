# Write a Maxitor plugin: a tutorial

You write a working Maxitor plugin step by step, on the plugin template `packages/maxitor-plugin-template` — the plugin "Notes" (`notes`). Every chapter quotes the template's own code, a check keeps those quotes equal to the files, and every chapter ends with something you run and see answer.

The [plugin concept](../concept.md) explains how plugins are built and why; [versioned storage](../versioned-storage.md) explains how a plugin keeps its data and its past. This tutorial is the path through them.

| # | Chapter | What it gives | Written by |
|---|---|---|---|
| 1 | [What you will build](01-what-you-will-build.md) | The plugin, the tools, the local stand running | bystrovmaxim/gnomon#99, bystrovmaxim/gnomon#110 |
| 2 | [A copy of the template](02-a-copy-of-the-template.md) | Your plugin's name and passport, checked, its frontend built as Maxitor builds it | bystrovmaxim/gnomon#99, bystrovmaxim/gnomon#110 |
| 3 | [Your tables](03-your-tables.md) | `schema.yaml`, the keys to the core | bystrovmaxim/gnomon#99 |
| 4 | [Reading](04-reading.md) | A reading action at any moment | bystrovmaxim/gnomon#99 |
| 5 | [Writing](05-writing.md) | A changing action in one transaction, its conflict | bystrovmaxim/gnomon#99 |
| 6 | [The backend](06-the-backend.md) | `app.py`, the gateway's token, the core's roles | bystrovmaxim/gnomon#99 |
| 7 | [A place in the tree](07-a-place-in-the-tree.md) | `navigation.yaml`, list nodes, what Maxitor checks, the page in the right panel, its three kinds of filter | bystrovmaxim/gnomon#103, bystrovmaxim/gnomon#74, bystrovmaxim/gnomon#109, bystrovmaxim/gnomon#115 |
| 8 | [The page](08-the-page.md) | The Next.js frontend on `@maxitor/panel`, the canvas, the draft with its states and reverts, publishing with its conflicts | bystrovmaxim/gnomon#102, bystrovmaxim/gnomon#121 |
| 9 | [Now and the past](09-now-and-the-past.md) | `at` in the address, `panel.watermark`, the draft private until publication | bystrovmaxim/gnomon#102 (now), bystrovmaxim/gnomon#121 (the draft), bystrovmaxim/gnomon#100 |
| 10 | History on the scale | `history` in the passport and the pages | bystrovmaxim/gnomon#100 |
| 11 | Comparing | Diff and side by side | bystrovmaxim/gnomon#100 |
| 12 | Presence and following | What works with no code | bystrovmaxim/gnomon#76 |
| 13 | [Tests](13-tests.md) | What a plugin must prove | bystrovmaxim/gnomon#99, grown by every step; bystrovmaxim/gnomon#110: the frontend's build; bystrovmaxim/gnomon#115: filters and dates; bystrovmaxim/gnomon#116: the page's history; bystrovmaxim/gnomon#102: the pages now; bystrovmaxim/gnomon#121: the draft, its conflicts and the past |
| 14 | A release | The wheel, the marketplace | bystrovmaxim/gnomon#92 |
| 15 | In an organization | Installing, disabling, enabling | bystrovmaxim/gnomon#92 |
| 16 | Versions and compatibility | `requires.maxitor`, `sdk`, the major version | bystrovmaxim/gnomon#77 |
| 17 | Depending on another plugin | A dependency, its calls and its events | bystrovmaxim/gnomon#95 |

A chapter without a link is written by the step named beside it, once what it describes runs.
