-- packages/maxitor/maxitor-core/maxitor/core/migrations/plugins/0002_plugin_processes.sql
-- The processes the runner keeps for every deployed version enabled somewhere, and each version's service key.

CREATE TABLE plugin_process (
    id                uuid        NOT NULL,
    plugin_version_id uuid        NOT NULL,
    kind              text        NOT NULL,
    address           text        NULL,
    container         text        NULL,
    started_at        timestamptz NULL,
    failures          integer     NOT NULL,
    next_start_at     timestamptz NULL,
    updated_at        timestamptz NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT plugin_process_version FOREIGN KEY (plugin_version_id) REFERENCES plugin_version (id),
    CONSTRAINT plugin_process_one_per_kind UNIQUE (plugin_version_id, kind),
    CONSTRAINT plugin_process_kind_value CHECK (kind IN ('backend', 'frontend')),
    CONSTRAINT plugin_process_address_shape CHECK (address IS NULL OR address ~ '^http://127\.0\.0\.1:[0-9]{1,5}$'),
    CONSTRAINT plugin_process_failures_count CHECK (failures >= 0)
);
COMMENT ON TABLE plugin_process IS 'A running backend or frontend container of a deployed version, kept by the runner; mechanics of work, without versions.';
COMMENT ON COLUMN plugin_process.id IS 'The process row.';
COMMENT ON COLUMN plugin_process.plugin_version_id IS 'The deployed version the process runs.';
COMMENT ON COLUMN plugin_process.kind IS 'backend or frontend.';
COMMENT ON COLUMN plugin_process.address IS 'The inner address http://127.0.0.1:<port> once the process accepts; NULL while it starts or waits.';
COMMENT ON COLUMN plugin_process.container IS 'The Docker container that runs it, maxitor-<schema>-<kind>; NULL while it waits.';
COMMENT ON COLUMN plugin_process.started_at IS 'When the running process started; NULL while it waits.';
COMMENT ON COLUMN plugin_process.failures IS 'How many starts failed or exited in a row since the last good start.';
COMMENT ON COLUMN plugin_process.next_start_at IS 'The earliest next start after a failure; NULL when it may start at once.';
COMMENT ON COLUMN plugin_process.updated_at IS 'When the row last changed.';

ALTER TABLE plugin_version ADD COLUMN service_key_hash char(64) NULL;
ALTER TABLE plugin_version ADD CONSTRAINT plugin_version_service_key_shape
    CHECK (service_key_hash IS NULL OR service_key_hash ~ '^[0-9a-f]{64}$');
COMMENT ON COLUMN plugin_version.service_key_hash IS 'The SHA-256 of the version''s service key, 64 lower-case hexadecimal characters; NULL until deployed.';
ALTER TABLE plugin_version_versions ADD COLUMN service_key_hash char(64) NULL;
COMMENT ON COLUMN plugin_version_versions.service_key_hash IS 'The SHA-256 of the version''s service key; NULL until deployed in this version.';
CREATE UNIQUE INDEX plugin_version_service_key ON plugin_version (service_key_hash) WHERE service_key_hash IS NOT NULL;
COMMENT ON INDEX plugin_version_service_key IS 'Finds the version a service key belongs to.';
