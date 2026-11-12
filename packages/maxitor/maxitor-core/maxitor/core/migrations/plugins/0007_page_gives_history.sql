-- packages/maxitor/maxitor-core/maxitor/core/migrations/plugins/0007_page_gives_history.sql
-- A page gives the core its history (spec 082): navigation format 3 is the tree only, and a room shares no
-- parameter, so a node keeps no room. What a page's history is checked against is the version's: the names of its
-- actions and its passport's comparisons, kept when the version is checked.

ALTER TABLE plugin_node DROP COLUMN room;
ALTER TABLE plugin_node_versions DROP COLUMN room;

ALTER TABLE plugin_version ADD COLUMN history_actions text[] NULL;
ALTER TABLE plugin_version ADD COLUMN history_compare text[] NULL;
COMMENT ON COLUMN plugin_version.history_actions IS 'The names of the actions its wheel holds, actions/ and history/ alike: what a page''s history may name; NULL until checked.';
COMMENT ON COLUMN plugin_version.history_compare IS 'The comparisons its passport''s history offers, diff and side_by_side; a page narrows them; NULL until checked.';
ALTER TABLE plugin_version_versions ADD COLUMN history_actions text[] NULL;
ALTER TABLE plugin_version_versions ADD COLUMN history_compare text[] NULL;
COMMENT ON COLUMN plugin_version_versions.history_actions IS 'The names of the version''s actions in this version of the row; NULL until checked.';
COMMENT ON COLUMN plugin_version_versions.history_compare IS 'The passport''s comparisons in this version of the row; NULL until checked.';
