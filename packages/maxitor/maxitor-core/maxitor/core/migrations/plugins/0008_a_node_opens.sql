-- packages/maxitor/maxitor-core/maxitor/core/migrations/plugins/0008_a_node_opens.sql
-- A node says how it opens (spec 085): navigation format 4 writes `opens` on every node with children, expand or
-- enter. A version checked under format 3 says nothing, and every node of it expands, so every row there starts as
-- expand, written out here rather than left to a default.

ALTER TABLE plugin_node ADD COLUMN opens text;
UPDATE plugin_node SET opens = 'expand';
ALTER TABLE plugin_node ALTER COLUMN opens SET NOT NULL;
ALTER TABLE plugin_node ADD CONSTRAINT plugin_node_opens CHECK (opens IN ('expand', 'enter'));
COMMENT ON COLUMN plugin_node.opens IS 'expand: its children appear under it in the tree; enter: the left panel holds only its children. Format 3''s nodes expand.';

ALTER TABLE plugin_node_versions ADD COLUMN opens text;
UPDATE plugin_node_versions SET opens = 'expand';
ALTER TABLE plugin_node_versions ALTER COLUMN opens SET NOT NULL;
ALTER TABLE plugin_node_versions ADD CONSTRAINT plugin_node_versions_opens CHECK (opens IN ('expand', 'enter'));
COMMENT ON COLUMN plugin_node_versions.opens IS 'How it opened in this version: expand or enter.';
