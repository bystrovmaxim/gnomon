-- packages/maxitor/maxitor-core/maxitor/core/migrations/plugins/0005_plugin_build.sql
-- The core builds every plugin's frontend with its own @maxitor/panel (spec 080): one build of a version for each
-- core version, kept by the installer, read by the runner for the image it runs.

CREATE TABLE plugin_build (
    id                uuid        NOT NULL,
    plugin_version_id uuid        NOT NULL,
    core_version      text        NOT NULL,
    state             text        NOT NULL,
    image             text        NULL,
    error             text        NULL,
    started_at        timestamptz NOT NULL,
    finished_at       timestamptz NULL,
    PRIMARY KEY (id),
    CONSTRAINT plugin_build_version FOREIGN KEY (plugin_version_id) REFERENCES plugin_version (id),
    CONSTRAINT plugin_build_one_per_core UNIQUE (plugin_version_id, core_version),
    CONSTRAINT plugin_build_core_version_shape CHECK (core_version ~ '^[0-9]+\.[0-9]+\.[0-9]+([a-z0-9.+-]*)$'),
    CONSTRAINT plugin_build_state_value CHECK (state IN ('building', 'built', 'failed')),
    CONSTRAINT plugin_build_image_when_built CHECK ((state = 'built') = (image IS NOT NULL)),
    CONSTRAINT plugin_build_error_when_failed CHECK ((state = 'failed') = (error IS NOT NULL))
);
COMMENT ON TABLE plugin_build IS 'One build of a plugin version''s frontend for one core version, kept by the installer; mechanics of work, without versions.';
COMMENT ON COLUMN plugin_build.id IS 'The build.';
COMMENT ON COLUMN plugin_build.plugin_version_id IS 'The plugin version whose frontend was built.';
COMMENT ON COLUMN plugin_build.core_version IS 'The core version whose builder image and @maxitor packages made it, 4.5.0.';
COMMENT ON COLUMN plugin_build.state IS 'building, built or failed.';
COMMENT ON COLUMN plugin_build.image IS 'The frontend''s image once built, maxitor-plugin/<schema>-frontend:<sha12>-<core version>; NULL otherwise.';
COMMENT ON COLUMN plugin_build.error IS 'The first error of the step that failed; NULL unless failed.';
COMMENT ON COLUMN plugin_build.started_at IS 'When the build started.';
COMMENT ON COLUMN plugin_build.finished_at IS 'When the build ended; NULL while it runs.';

GRANT SELECT, INSERT, UPDATE ON plugin_build TO maxitor_installer;
