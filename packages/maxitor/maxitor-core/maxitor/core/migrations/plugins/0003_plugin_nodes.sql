-- packages/maxitor/maxitor-core/maxitor/core/migrations/plugins/0003_plugin_nodes.sql
-- Every node of a version's navigation.yaml, resolved when the version is checked (spec 077): the tree of an
-- organization is the core's nodes and the nodes of the versions enabled in it. It takes the place of plugin_section,
-- which held only the top level; a version checked before keeps its sections as top-level nodes.

CREATE TABLE plugin_node (
    id                uuid        NOT NULL,
    plugin_version_id uuid        NOT NULL,
    full_name         text        NOT NULL,
    parent            text        NOT NULL,
    position          integer     NOT NULL,
    node_order        integer     NOT NULL,
    title             text        NULL,
    icon              text        NULL,
    page              text        NULL,
    each_source       text        NULL,
    each_key          text        NULL,
    roles             text[]      NOT NULL,
    controls          jsonb       NULL,
    room              jsonb       NULL,
    created_at        timestamptz NOT NULL,
    updated_at        timestamptz NULL,
    PRIMARY KEY (id),
    CONSTRAINT plugin_node_version FOREIGN KEY (plugin_version_id) REFERENCES plugin_version (id),
    CONSTRAINT plugin_node_name_unique UNIQUE (plugin_version_id, full_name),
    CONSTRAINT plugin_node_position_unique UNIQUE (plugin_version_id, position),
    CONSTRAINT plugin_node_list_whole CHECK ((each_source IS NULL) = (each_key IS NULL))
);
COMMENT ON TABLE plugin_node IS 'One node of a version''s navigation.yaml, with its full name and the node it stands under.';
COMMENT ON COLUMN plugin_node.id IS 'The node''s row.';
COMMENT ON COLUMN plugin_node.plugin_version_id IS 'The version whose navigation it comes from.';
COMMENT ON COLUMN plugin_node.full_name IS 'Its full name, <plugin name>:<node id>, unique within the version.';
COMMENT ON COLUMN plugin_node.parent IS 'root, a node of the core (core:<id>), of a dependency (<name>:<id>) or of its own plugin.';
COMMENT ON COLUMN plugin_node.position IS 'Its place in the file, from 1: the order among equal order values.';
COMMENT ON COLUMN plugin_node.node_order IS 'Its order among the children of its parent; 0 when the file names none.';
COMMENT ON COLUMN plugin_node.title IS 'An ordinary node''s title; NULL for a list node, whose instances take theirs from its source.';
COMMENT ON COLUMN plugin_node.icon IS 'A name of the core''s icon set; NULL for none.';
COMMENT ON COLUMN plugin_node.page IS 'The page''s path template inside the plugin; NULL for a node that only groups.';
COMMENT ON COLUMN plugin_node.each_source IS 'A list node''s reading action of the plugin; NULL for an ordinary node.';
COMMENT ON COLUMN plugin_node.each_key IS 'The parameter each instance of a list node adds to the scope; NULL for an ordinary node.';
COMMENT ON COLUMN plugin_node.roles IS 'The core''s roles needed to see it, member or administrator; empty for every member.';
COMMENT ON COLUMN plugin_node.controls IS 'The page''s controls as the file writes them; NULL for none.';
COMMENT ON COLUMN plugin_node.room IS 'The page''s behaviour with other people as the file writes it; NULL for none.';
COMMENT ON COLUMN plugin_node.created_at IS 'When it was read from the navigation.';
COMMENT ON COLUMN plugin_node.updated_at IS 'When it last changed; NULL if never.';

CREATE TABLE plugin_node_versions (
    id                uuid        NOT NULL,
    valid_from_at     timestamptz NOT NULL,
    valid_to_at       timestamptz NULL,
    valid_during      tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id         uuid        NULL,
    operation         text        NOT NULL,
    closed_by         uuid        NULL,
    closed_operation  text        NULL,
    plugin_version_id uuid        NOT NULL,
    full_name         text        NOT NULL,
    parent            text        NOT NULL,
    position          integer     NOT NULL,
    node_order        integer     NOT NULL,
    title             text        NULL,
    icon              text        NULL,
    page              text        NULL,
    each_source       text        NULL,
    each_key          text        NULL,
    roles             text[]      NOT NULL,
    controls          jsonb       NULL,
    room              jsonb       NULL,
    created_at        timestamptz NOT NULL,
    updated_at        timestamptz NULL,
    PRIMARY KEY (id, valid_from_at),
    CONSTRAINT plugin_node_versions_no_overlap EXCLUDE USING gist (id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE plugin_node_versions IS 'Every state of plugin_node rows, each with the period it was in force.';
COMMENT ON COLUMN plugin_node_versions.id IS 'The node''s row; the same in all its versions.';
COMMENT ON COLUMN plugin_node_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN plugin_node_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN plugin_node_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN plugin_node_versions.author_id IS 'The account or user who opened the version; NULL for a system operation.';
COMMENT ON COLUMN plugin_node_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN plugin_node_versions.closed_by IS 'Who closed the version; NULL while open.';
COMMENT ON COLUMN plugin_node_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN plugin_node_versions.plugin_version_id IS 'The version whose navigation it comes from in this version.';
COMMENT ON COLUMN plugin_node_versions.full_name IS 'Its full name in this version.';
COMMENT ON COLUMN plugin_node_versions.parent IS 'The node it stands under in this version.';
COMMENT ON COLUMN plugin_node_versions.position IS 'Its place in the file in this version.';
COMMENT ON COLUMN plugin_node_versions.node_order IS 'Its order among its parent''s children in this version.';
COMMENT ON COLUMN plugin_node_versions.title IS 'Its title in this version; NULL for a list node.';
COMMENT ON COLUMN plugin_node_versions.icon IS 'Its icon in this version; NULL for none.';
COMMENT ON COLUMN plugin_node_versions.page IS 'Its page template in this version; NULL for a node that only groups.';
COMMENT ON COLUMN plugin_node_versions.each_source IS 'Its list source in this version; NULL for an ordinary node.';
COMMENT ON COLUMN plugin_node_versions.each_key IS 'Its list key in this version; NULL for an ordinary node.';
COMMENT ON COLUMN plugin_node_versions.roles IS 'The roles needed to see it in this version.';
COMMENT ON COLUMN plugin_node_versions.controls IS 'Its controls in this version; NULL for none.';
COMMENT ON COLUMN plugin_node_versions.room IS 'Its behaviour with other people in this version; NULL for none.';
COMMENT ON COLUMN plugin_node_versions.created_at IS 'When it was read from the navigation in this version.';
COMMENT ON COLUMN plugin_node_versions.updated_at IS 'When it last changed; NULL if never in this version.';
CREATE INDEX plugin_node_versions_open ON plugin_node_versions (id) WHERE valid_to_at IS NULL;
COMMENT ON INDEX plugin_node_versions_open IS 'Finds the version of a row in force now.';
CREATE INDEX plugin_node_version_index ON plugin_node (plugin_version_id);
COMMENT ON INDEX plugin_node_version_index IS 'Finds the nodes of a version.';

-- A version checked before keeps each top-level section as a top-level node of its plugin, with its version open from
-- the section's own.
INSERT INTO plugin_node (id, plugin_version_id, full_name, parent, position, node_order, title, icon, page, each_source,
                         each_key, roles, controls, room, created_at, updated_at)
SELECT s.id, s.plugin_version_id, p.name || ':section-' || s.position, 'root', s.position, s.position * 100, s.title,
       NULL, CASE WHEN s.path = '' THEN NULL ELSE s.path END, NULL, NULL, '{}', NULL, NULL, s.created_at, s.updated_at
FROM plugin_section s
JOIN plugin_version v ON v.id = s.plugin_version_id
JOIN plugin p ON p.id = v.plugin_id;
INSERT INTO plugin_node_versions (id, valid_from_at, valid_to_at, author_id, operation, closed_by, closed_operation,
                                  plugin_version_id, full_name, parent, position, node_order, title, icon, page,
                                  each_source, each_key, roles, controls, room, created_at, updated_at)
SELECT n.id, sv.valid_from_at, NULL, sv.author_id, sv.operation, NULL, NULL, n.plugin_version_id, n.full_name, n.parent,
       n.position, n.node_order, n.title, n.icon, n.page, NULL, NULL, n.roles, NULL, NULL, n.created_at, n.updated_at
FROM plugin_node n
JOIN plugin_section_versions sv ON sv.id = n.id AND sv.valid_to_at IS NULL;

DROP TABLE plugin_section_versions;
DROP TABLE plugin_section;

GRANT SELECT, INSERT, UPDATE ON plugin_node, plugin_node_versions TO maxitor_installer;
