-- 0001_plugins.sql — the schema plugins: the marketplace and the plugins of each organization.
-- Runs as maxitor_core with search_path = plugins, organization, platform, extensions; no name below says its schema,
-- so "organization" and "user" resolve to the tables of the schema organization. No identifier has a default; nothing
-- cascades. The role maxitor_installer moves rows through their states (FR-026a).

CREATE TABLE plugin (
    id                    uuid        NOT NULL,
    passport_id           text        NOT NULL,
    name                  text        NOT NULL,
    title                 text        NOT NULL,
    description           text        NOT NULL,
    owner_organization_id uuid        NULL,
    state                 text        NOT NULL,
    created_at            timestamptz NOT NULL,
    updated_at            timestamptz NULL,
    PRIMARY KEY (id),
    CONSTRAINT plugin_passport_id_unique UNIQUE (passport_id),
    CONSTRAINT plugin_name_unique UNIQUE (name),
    CONSTRAINT plugin_name_shape CHECK (name ~ '^[a-z][a-z0-9_]{0,31}$'),
    CONSTRAINT plugin_state_value CHECK (state IN ('listed', 'withdrawn')),
    CONSTRAINT plugin_owner_organization FOREIGN KEY (owner_organization_id) REFERENCES organization (id)
);
COMMENT ON TABLE plugin IS 'A plugin of the marketplace, public or private to one organization.';
COMMENT ON COLUMN plugin.id IS 'The plugin.';
COMMENT ON COLUMN plugin.passport_id IS 'The plugin''s id from its passport, in reverse domain notation; unique across the marketplace.';
COMMENT ON COLUMN plugin.name IS 'The plugin''s name, the start of its schemas'' names; unique across the marketplace.';
COMMENT ON COLUMN plugin.title IS 'The plugin''s title for people.';
COMMENT ON COLUMN plugin.description IS 'What the plugin does, for the marketplace''s card.';
COMMENT ON COLUMN plugin.owner_organization_id IS 'The organization a private plugin belongs to; NULL for a public plugin. From the schema organization.';
COMMENT ON COLUMN plugin.state IS 'listed or withdrawn.';
COMMENT ON COLUMN plugin.created_at IS 'When the plugin entered the marketplace.';
COMMENT ON COLUMN plugin.updated_at IS 'When it last changed; NULL if never.';

CREATE TABLE plugin_versions (
    id                    uuid        NOT NULL,
    valid_from_at         timestamptz NOT NULL,
    valid_to_at           timestamptz NULL,
    valid_during          tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id             uuid        NULL,
    operation             text        NOT NULL,
    closed_by             uuid        NULL,
    closed_operation      text        NULL,
    passport_id           text        NOT NULL,
    name                  text        NOT NULL,
    title                 text        NOT NULL,
    description           text        NOT NULL,
    owner_organization_id uuid        NULL,
    state                 text        NOT NULL,
    created_at            timestamptz NOT NULL,
    updated_at            timestamptz NULL,
    PRIMARY KEY (id, valid_from_at),
    CONSTRAINT plugin_versions_no_overlap EXCLUDE USING gist (id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE plugin_versions IS 'Every state of plugin rows, each with the period it was in force.';
COMMENT ON COLUMN plugin_versions.id IS 'The plugin; the same in all its versions.';
COMMENT ON COLUMN plugin_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN plugin_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN plugin_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN plugin_versions.author_id IS 'The account or user who opened the version; NULL for a system operation.';
COMMENT ON COLUMN plugin_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN plugin_versions.closed_by IS 'Who closed the version; NULL while open.';
COMMENT ON COLUMN plugin_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN plugin_versions.passport_id IS 'The plugin''s id from its passport, in reverse domain notation; unique across the marketplace in this version.';
COMMENT ON COLUMN plugin_versions.name IS 'The plugin''s name, the start of its schemas'' names; unique across the marketplace in this version.';
COMMENT ON COLUMN plugin_versions.title IS 'The plugin''s title for people in this version.';
COMMENT ON COLUMN plugin_versions.description IS 'What the plugin does, for the marketplace''s card in this version.';
COMMENT ON COLUMN plugin_versions.owner_organization_id IS 'The organization a private plugin belongs to; NULL for a public plugin. From the schema organization in this version.';
COMMENT ON COLUMN plugin_versions.state IS 'listed or withdrawn in this version.';
COMMENT ON COLUMN plugin_versions.created_at IS 'When the plugin entered the marketplace in this version.';
COMMENT ON COLUMN plugin_versions.updated_at IS 'When it last changed; NULL if never in this version.';
CREATE INDEX plugin_versions_open ON plugin_versions (id) WHERE valid_to_at IS NULL;
COMMENT ON INDEX plugin_versions_open IS 'Finds the version of a row in force now.';

CREATE TABLE plugin_version (
    id            uuid        NOT NULL,
    plugin_id     uuid        NOT NULL,
    version       text        NOT NULL,
    purl          text        NOT NULL,
    sha256        char(64)    NOT NULL,
    core_range    text        NULL,
    state         text        NOT NULL,
    reason        text        NULL,
    schema_name   text        NULL,
    database_user text        NULL,
    deployed_at   timestamptz NULL,
    checked_at    timestamptz NULL,
    created_at    timestamptz NOT NULL,
    updated_at    timestamptz NULL,
    PRIMARY KEY (id),
    CONSTRAINT plugin_version_plugin FOREIGN KEY (plugin_id) REFERENCES plugin (id),
    CONSTRAINT plugin_version_unique UNIQUE (plugin_id, version),
    CONSTRAINT plugin_version_schema_unique UNIQUE (schema_name),
    CONSTRAINT plugin_version_state_value CHECK (state IN ('draft', 'active', 'rejected', 'withdrawn')),
    CONSTRAINT plugin_version_version_shape CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
    CONSTRAINT plugin_version_sha256_shape CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT plugin_version_rejected_reason CHECK (reason IS NOT NULL OR state <> 'rejected')
);
COMMENT ON TABLE plugin_version IS 'One release x.y.z of a plugin: its wheel, its passport and, once deployed, its schema.';
COMMENT ON COLUMN plugin_version.id IS 'The version.';
COMMENT ON COLUMN plugin_version.plugin_id IS 'The plugin it is a version of.';
COMMENT ON COLUMN plugin_version.version IS 'The version, x.y.z.';
COMMENT ON COLUMN plugin_version.purl IS 'The wheel''s source as a Package URL.';
COMMENT ON COLUMN plugin_version.sha256 IS 'The wheel''s SHA-256, 64 lower-case hexadecimal characters; names its file in the wheel store.';
COMMENT ON COLUMN plugin_version.core_range IS 'The core range of its passport; NULL until checked.';
COMMENT ON COLUMN plugin_version.state IS 'draft, active, rejected or withdrawn.';
COMMENT ON COLUMN plugin_version.reason IS 'Why it was rejected, or why its check waits; NULL when there is nothing to say.';
COMMENT ON COLUMN plugin_version.schema_name IS 'Its schema once deployed; NULL before.';
COMMENT ON COLUMN plugin_version.database_user IS 'Its database user once deployed; NULL before.';
COMMENT ON COLUMN plugin_version.deployed_at IS 'When it was deployed; NULL before.';
COMMENT ON COLUMN plugin_version.checked_at IS 'When its check ended; NULL while draft.';
COMMENT ON COLUMN plugin_version.created_at IS 'When the version was added.';
COMMENT ON COLUMN plugin_version.updated_at IS 'When it last changed; NULL if never.';

CREATE TABLE plugin_version_versions (
    id               uuid        NOT NULL,
    valid_from_at    timestamptz NOT NULL,
    valid_to_at      timestamptz NULL,
    valid_during     tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id        uuid        NULL,
    operation        text        NOT NULL,
    closed_by        uuid        NULL,
    closed_operation text        NULL,
    plugin_id        uuid        NOT NULL,
    version          text        NOT NULL,
    purl             text        NOT NULL,
    sha256           char(64)    NOT NULL,
    core_range       text        NULL,
    state            text        NOT NULL,
    reason           text        NULL,
    schema_name      text        NULL,
    database_user    text        NULL,
    deployed_at      timestamptz NULL,
    checked_at       timestamptz NULL,
    created_at       timestamptz NOT NULL,
    updated_at       timestamptz NULL,
    PRIMARY KEY (id, valid_from_at),
    CONSTRAINT plugin_version_versions_no_overlap EXCLUDE USING gist (id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE plugin_version_versions IS 'Every state of plugin_version rows, each with the period it was in force.';
COMMENT ON COLUMN plugin_version_versions.id IS 'The version; the same in all its versions.';
COMMENT ON COLUMN plugin_version_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN plugin_version_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN plugin_version_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN plugin_version_versions.author_id IS 'The account or user who opened the version; NULL for a system operation.';
COMMENT ON COLUMN plugin_version_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN plugin_version_versions.closed_by IS 'Who closed the version; NULL while open.';
COMMENT ON COLUMN plugin_version_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN plugin_version_versions.plugin_id IS 'The plugin it is a version of in this version.';
COMMENT ON COLUMN plugin_version_versions.version IS 'The version, x.y.z in this version.';
COMMENT ON COLUMN plugin_version_versions.purl IS 'The wheel''s source as a Package URL in this version.';
COMMENT ON COLUMN plugin_version_versions.sha256 IS 'The wheel''s SHA-256, 64 lower-case hexadecimal characters; names its file in the wheel store in this version.';
COMMENT ON COLUMN plugin_version_versions.core_range IS 'The core range of its passport; NULL until checked in this version.';
COMMENT ON COLUMN plugin_version_versions.state IS 'draft, active, rejected or withdrawn in this version.';
COMMENT ON COLUMN plugin_version_versions.reason IS 'Why it was rejected, or why its check waits; NULL when there is nothing to say in this version.';
COMMENT ON COLUMN plugin_version_versions.schema_name IS 'Its schema once deployed; NULL before in this version.';
COMMENT ON COLUMN plugin_version_versions.database_user IS 'Its database user once deployed; NULL before in this version.';
COMMENT ON COLUMN plugin_version_versions.deployed_at IS 'When it was deployed; NULL before in this version.';
COMMENT ON COLUMN plugin_version_versions.checked_at IS 'When its check ended; NULL while draft in this version.';
COMMENT ON COLUMN plugin_version_versions.created_at IS 'When the version was added in this version.';
COMMENT ON COLUMN plugin_version_versions.updated_at IS 'When it last changed; NULL if never in this version.';
CREATE INDEX plugin_version_versions_open ON plugin_version_versions (id) WHERE valid_to_at IS NULL;
COMMENT ON INDEX plugin_version_versions_open IS 'Finds the version of a row in force now.';

CREATE TABLE plugin_dependency (
    id                uuid        NOT NULL,
    plugin_version_id uuid        NOT NULL,
    passport_id       text        NOT NULL,
    version_range     text        NOT NULL,
    created_at        timestamptz NOT NULL,
    updated_at        timestamptz NULL,
    PRIMARY KEY (id),
    CONSTRAINT plugin_dependency_version FOREIGN KEY (plugin_version_id) REFERENCES plugin_version (id),
    CONSTRAINT plugin_dependency_unique UNIQUE (plugin_version_id, passport_id)
);
COMMENT ON TABLE plugin_dependency IS 'A plugin a version needs, named by passport id and version range, from the version''s passport.';
COMMENT ON COLUMN plugin_dependency.id IS 'The dependency.';
COMMENT ON COLUMN plugin_dependency.plugin_version_id IS 'The version that needs it.';
COMMENT ON COLUMN plugin_dependency.passport_id IS 'The needed plugin''s passport id; the plugin may not be in the marketplace yet.';
COMMENT ON COLUMN plugin_dependency.version_range IS 'The versions of it the passport accepts.';
COMMENT ON COLUMN plugin_dependency.created_at IS 'When it was read from the passport.';
COMMENT ON COLUMN plugin_dependency.updated_at IS 'When it last changed; NULL if never.';

CREATE TABLE plugin_dependency_versions (
    id                uuid        NOT NULL,
    valid_from_at     timestamptz NOT NULL,
    valid_to_at       timestamptz NULL,
    valid_during      tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id         uuid        NULL,
    operation         text        NOT NULL,
    closed_by         uuid        NULL,
    closed_operation  text        NULL,
    plugin_version_id uuid        NOT NULL,
    passport_id       text        NOT NULL,
    version_range     text        NOT NULL,
    created_at        timestamptz NOT NULL,
    updated_at        timestamptz NULL,
    PRIMARY KEY (id, valid_from_at),
    CONSTRAINT plugin_dependency_versions_no_overlap EXCLUDE USING gist (id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE plugin_dependency_versions IS 'Every state of plugin_dependency rows, each with the period it was in force.';
COMMENT ON COLUMN plugin_dependency_versions.id IS 'The dependency; the same in all its versions.';
COMMENT ON COLUMN plugin_dependency_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN plugin_dependency_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN plugin_dependency_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN plugin_dependency_versions.author_id IS 'The account or user who opened the version; NULL for a system operation.';
COMMENT ON COLUMN plugin_dependency_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN plugin_dependency_versions.closed_by IS 'Who closed the version; NULL while open.';
COMMENT ON COLUMN plugin_dependency_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN plugin_dependency_versions.plugin_version_id IS 'The version that needs it in this version.';
COMMENT ON COLUMN plugin_dependency_versions.passport_id IS 'The needed plugin''s passport id; the plugin may not be in the marketplace yet in this version.';
COMMENT ON COLUMN plugin_dependency_versions.version_range IS 'The versions of it the passport accepts in this version.';
COMMENT ON COLUMN plugin_dependency_versions.created_at IS 'When it was read from the passport in this version.';
COMMENT ON COLUMN plugin_dependency_versions.updated_at IS 'When it last changed; NULL if never in this version.';
CREATE INDEX plugin_dependency_versions_open ON plugin_dependency_versions (id) WHERE valid_to_at IS NULL;
COMMENT ON INDEX plugin_dependency_versions_open IS 'Finds the version of a row in force now.';

CREATE TABLE plugin_section (
    id                uuid        NOT NULL,
    plugin_version_id uuid        NOT NULL,
    position          integer     NOT NULL,
    title             text        NOT NULL,
    path              text        NOT NULL,
    created_at        timestamptz NOT NULL,
    updated_at        timestamptz NULL,
    PRIMARY KEY (id),
    CONSTRAINT plugin_section_version FOREIGN KEY (plugin_version_id) REFERENCES plugin_version (id),
    CONSTRAINT plugin_section_position_unique UNIQUE (plugin_version_id, position)
);
COMMENT ON TABLE plugin_section IS 'One top-level section of a version''s navigation, a row of the organization''s tree.';
COMMENT ON COLUMN plugin_section.id IS 'The section.';
COMMENT ON COLUMN plugin_section.plugin_version_id IS 'The version whose navigation it comes from.';
COMMENT ON COLUMN plugin_section.position IS 'Its place among the version''s sections, from 1.';
COMMENT ON COLUMN plugin_section.title IS 'The section''s title in the tree.';
COMMENT ON COLUMN plugin_section.path IS 'The section''s path inside the plugin''s pages.';
COMMENT ON COLUMN plugin_section.created_at IS 'When it was read from the navigation.';
COMMENT ON COLUMN plugin_section.updated_at IS 'When it last changed; NULL if never.';

CREATE TABLE plugin_section_versions (
    id                uuid        NOT NULL,
    valid_from_at     timestamptz NOT NULL,
    valid_to_at       timestamptz NULL,
    valid_during      tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id         uuid        NULL,
    operation         text        NOT NULL,
    closed_by         uuid        NULL,
    closed_operation  text        NULL,
    plugin_version_id uuid        NOT NULL,
    position          integer     NOT NULL,
    title             text        NOT NULL,
    path              text        NOT NULL,
    created_at        timestamptz NOT NULL,
    updated_at        timestamptz NULL,
    PRIMARY KEY (id, valid_from_at),
    CONSTRAINT plugin_section_versions_no_overlap EXCLUDE USING gist (id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE plugin_section_versions IS 'Every state of plugin_section rows, each with the period it was in force.';
COMMENT ON COLUMN plugin_section_versions.id IS 'The section; the same in all its versions.';
COMMENT ON COLUMN plugin_section_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN plugin_section_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN plugin_section_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN plugin_section_versions.author_id IS 'The account or user who opened the version; NULL for a system operation.';
COMMENT ON COLUMN plugin_section_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN plugin_section_versions.closed_by IS 'Who closed the version; NULL while open.';
COMMENT ON COLUMN plugin_section_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN plugin_section_versions.plugin_version_id IS 'The version whose navigation it comes from in this version.';
COMMENT ON COLUMN plugin_section_versions.position IS 'Its place among the version''s sections, from 1 in this version.';
COMMENT ON COLUMN plugin_section_versions.title IS 'The section''s title in the tree in this version.';
COMMENT ON COLUMN plugin_section_versions.path IS 'The section''s path inside the plugin''s pages in this version.';
COMMENT ON COLUMN plugin_section_versions.created_at IS 'When it was read from the navigation in this version.';
COMMENT ON COLUMN plugin_section_versions.updated_at IS 'When it last changed; NULL if never in this version.';
CREATE INDEX plugin_section_versions_open ON plugin_section_versions (id) WHERE valid_to_at IS NULL;
COMMENT ON INDEX plugin_section_versions_open IS 'Finds the version of a row in force now.';

CREATE TABLE organization_plugin (
    organization_id   uuid        NOT NULL,
    id                uuid        NOT NULL,
    plugin_id         uuid        NOT NULL,
    plugin_version_id uuid        NOT NULL,
    state             text        NOT NULL,
    reason            text        NULL,
    installed_by      uuid        NOT NULL,
    created_at        timestamptz NOT NULL,
    updated_at        timestamptz NULL,
    PRIMARY KEY (organization_id, id),
    CONSTRAINT organization_plugin_organization FOREIGN KEY (organization_id) REFERENCES organization (id),
    CONSTRAINT organization_plugin_plugin FOREIGN KEY (plugin_id) REFERENCES plugin (id),
    CONSTRAINT organization_plugin_version FOREIGN KEY (plugin_version_id) REFERENCES plugin_version (id),
    CONSTRAINT organization_plugin_installed_by FOREIGN KEY (organization_id, installed_by) REFERENCES "user" (organization_id, id),
    CONSTRAINT organization_plugin_state_value CHECK (state IN ('installing', 'enabled', 'disabled', 'failed', 'removing', 'removed'))
);
COMMENT ON TABLE organization_plugin IS 'A plugin in one organization: which version it runs, its state, who installed it.';
COMMENT ON COLUMN organization_plugin.organization_id IS 'The organization, from the schema organization.';
COMMENT ON COLUMN organization_plugin.id IS 'The row.';
COMMENT ON COLUMN organization_plugin.plugin_id IS 'The plugin installed.';
COMMENT ON COLUMN organization_plugin.plugin_version_id IS 'The version the organization runs.';
COMMENT ON COLUMN organization_plugin.state IS 'installing, enabled, disabled, failed, removing or removed.';
COMMENT ON COLUMN organization_plugin.reason IS 'Why the install failed; NULL otherwise.';
COMMENT ON COLUMN organization_plugin.installed_by IS 'The administrator''s user in the organization who installed it.';
COMMENT ON COLUMN organization_plugin.created_at IS 'When the install was asked for.';
COMMENT ON COLUMN organization_plugin.updated_at IS 'When it last changed; NULL if never.';

CREATE TABLE organization_plugin_versions (
    organization_id   uuid        NOT NULL,
    id                uuid        NOT NULL,
    valid_from_at     timestamptz NOT NULL,
    valid_to_at       timestamptz NULL,
    valid_during      tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id         uuid        NULL,
    operation         text        NOT NULL,
    closed_by         uuid        NULL,
    closed_operation  text        NULL,
    plugin_id         uuid        NOT NULL,
    plugin_version_id uuid        NOT NULL,
    state             text        NOT NULL,
    reason            text        NULL,
    installed_by      uuid        NOT NULL,
    created_at        timestamptz NOT NULL,
    updated_at        timestamptz NULL,
    PRIMARY KEY (organization_id, id, valid_from_at),
    CONSTRAINT organization_plugin_versions_no_overlap EXCLUDE USING gist (organization_id WITH =, id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE organization_plugin_versions IS 'Every state of organization_plugin rows, each with the period it was in force.';
COMMENT ON COLUMN organization_plugin_versions.organization_id IS 'The organization, from the schema organization; the same in all its versions.';
COMMENT ON COLUMN organization_plugin_versions.id IS 'The row; the same in all its versions.';
COMMENT ON COLUMN organization_plugin_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN organization_plugin_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN organization_plugin_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN organization_plugin_versions.author_id IS 'The account or user who opened the version; NULL for a system operation.';
COMMENT ON COLUMN organization_plugin_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN organization_plugin_versions.closed_by IS 'Who closed the version; NULL while open.';
COMMENT ON COLUMN organization_plugin_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN organization_plugin_versions.plugin_id IS 'The plugin installed in this version.';
COMMENT ON COLUMN organization_plugin_versions.plugin_version_id IS 'The version the organization runs in this version.';
COMMENT ON COLUMN organization_plugin_versions.state IS 'installing, enabled, disabled, failed, removing or removed in this version.';
COMMENT ON COLUMN organization_plugin_versions.reason IS 'Why the install failed; NULL otherwise in this version.';
COMMENT ON COLUMN organization_plugin_versions.installed_by IS 'The administrator''s user in the organization who installed it in this version.';
COMMENT ON COLUMN organization_plugin_versions.created_at IS 'When the install was asked for in this version.';
COMMENT ON COLUMN organization_plugin_versions.updated_at IS 'When it last changed; NULL if never in this version.';
CREATE INDEX organization_plugin_versions_open ON organization_plugin_versions (organization_id, id) WHERE valid_to_at IS NULL;
COMMENT ON INDEX organization_plugin_versions_open IS 'Finds the version of a row in force now.';

CREATE UNIQUE INDEX organization_plugin_one_live ON organization_plugin (organization_id, plugin_id) WHERE state <> 'removed';
COMMENT ON INDEX organization_plugin_one_live IS 'At most one row not removed per organization and plugin.';
CREATE INDEX organization_plugin_pending ON organization_plugin (state) WHERE state = 'installing';
COMMENT ON INDEX organization_plugin_pending IS 'Finds the installs the installer has to take up.';
CREATE INDEX plugin_version_pending ON plugin_version (state) WHERE state = 'draft';
COMMENT ON INDEX plugin_version_pending IS 'Finds the versions the installer has to check.';
CREATE INDEX plugin_version_plugin ON plugin_version (plugin_id);
COMMENT ON INDEX plugin_version_plugin IS 'Finds the versions of a plugin.';
CREATE INDEX plugin_dependency_version ON plugin_dependency (plugin_version_id);
COMMENT ON INDEX plugin_dependency_version IS 'Finds the dependencies of a version.';
CREATE INDEX organization_plugin_version_index ON organization_plugin (plugin_version_id);
COMMENT ON INDEX organization_plugin_version_index IS 'Finds the organizations that run a version.';

GRANT USAGE ON SCHEMA plugins TO maxitor_installer;
GRANT SELECT, INSERT, UPDATE ON plugin, plugin_versions, plugin_version, plugin_version_versions, plugin_dependency,
    plugin_dependency_versions, plugin_section, plugin_section_versions, organization_plugin,
    organization_plugin_versions TO maxitor_installer;
-- The installer writes organization_plugin under the organization's lock, whose change time follows every version
-- table of the organization: it reads those version tables and nothing else of the schema organization.
GRANT USAGE ON SCHEMA organization TO maxitor_installer;
GRANT SELECT ON organization_versions, user_versions, boundary_versions, boundary_user_versions TO maxitor_installer;
