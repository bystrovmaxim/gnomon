# Changelog of @maxitor/panel

## 0.2.0

`PanelPage` is the shell of every page. A page gives it its filters, its layer pills, the sections of its bottom bar and its actions as data, and the shell draws them in the same places for every plugin — made from maxitor-web's filter panel, mode pill and zoom bar — and writes each into the address: a filter lists the rows switched on, a choice drops its default, the layer is `layer`, the paint switch `paint`, and a value the page no longer offers gives way to its default. The actions show only at now. `<MaxitorCanvas>` gives the shell its zoom, which stands first in the bottom bar, and fits its scene clear of the controls. The panel router refuses a change of `at`, `mode`, `from` or a `_…` name. `panel.ready` says whether the page renders the shell, with its version. The shell folds every part the same way on a phone. ([#109](https://github.com/bystrovmaxim/gnomon/issues/109))

## 0.1.0

What a plugin's page needs to live in Maxitor's right panel. `PanelDocument` is the page's document: transparent, so the core's field of dots shows through, with Maxitor's tokens. The panel's router asks the core for one history entry per change and never makes one inside the frame, so Back, Forward, a reload and a link to a colleague all give exactly what was on screen. A page reads its parameters and its moment from its address, rebuilds when the core says the address changed, reads again when "now" moves, sends its title to the top row and may open a page of the core or of a plugin it depends on. `Card` and `DataTable` draw the common content with the tokens.
