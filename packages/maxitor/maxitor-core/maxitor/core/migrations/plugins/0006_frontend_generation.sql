-- packages/maxitor/maxitor-core/maxitor/core/migrations/plugins/0006_frontend_generation.sql
-- Upgrading the core (spec 080): the site serves the frontends' builds of one core version at a time, and moves to
-- the builds of a new core version only when every enabled version has one.

CREATE TABLE frontend_generation (
    id                   smallint NOT NULL,
    serving_core_version text     NOT NULL,
    target_core_version  text     NULL,
    moved_at             timestamptz NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT frontend_generation_one_row CHECK (id = 1),
    CONSTRAINT frontend_generation_serving_shape CHECK (serving_core_version ~ '^[0-9]+\.[0-9]+\.[0-9]+([a-z0-9.+-]*)$'),
    CONSTRAINT frontend_generation_target_shape
        CHECK (target_core_version IS NULL OR target_core_version ~ '^[0-9]+\.[0-9]+\.[0-9]+([a-z0-9.+-]*)$')
);
COMMENT ON TABLE frontend_generation IS 'The core version whose frontend builds the site serves, and the one an upgrade builds for; one row, kept by the installer; mechanics of work, without versions.';
COMMENT ON COLUMN frontend_generation.id IS 'Always 1: the one row.';
COMMENT ON COLUMN frontend_generation.serving_core_version IS 'The builds of this core version are the ones the runner runs.';
COMMENT ON COLUMN frontend_generation.target_core_version IS 'The core version an upgrade builds every enabled version for; NULL when no upgrade waits.';
COMMENT ON COLUMN frontend_generation.moved_at IS 'When the serving core version was set last.';

GRANT SELECT, INSERT, UPDATE ON frontend_generation TO maxitor_installer;
