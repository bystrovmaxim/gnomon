-- packages/maxitor/maxitor-core/maxitor/core/migrations/plugins/0004_plugin_node_no_controls.sql
-- A page's controls are its own (spec 078): the shell of @maxitor/panel draws them from what the page gives it, and
-- navigation format 2 has no controls. The column leaves the table and its versions together.

ALTER TABLE plugin_node DROP COLUMN controls;
ALTER TABLE plugin_node_versions DROP COLUMN controls;
