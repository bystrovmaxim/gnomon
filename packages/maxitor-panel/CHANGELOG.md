# Changelog of @maxitor/panel

## 0.1.0

What a plugin's page needs to live in Maxitor's right panel. `PanelDocument` is the page's document: transparent, so the core's field of dots shows through, with Maxitor's tokens. The panel's router asks the core for one history entry per change and never makes one inside the frame, so Back, Forward, a reload and a link to a colleague all give exactly what was on screen. A page reads its parameters and its moment from its address, rebuilds when the core says the address changed, reads again when "now" moves, sends its title to the top row and may open a page of the core or of a plugin it depends on. `Card` and `DataTable` draw the common content with the tokens.
