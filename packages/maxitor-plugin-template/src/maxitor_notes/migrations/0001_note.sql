-- 0001_note.sql — the note: a current table and its version table, by the rules of versioned storage.
-- Runs under the plugin's own role plg_notes with search_path = notes, so every name below lands in the schema notes.
-- The foreign keys to core.items and core.members are not here: they are declared in foreign-keys.yaml and
-- Maxitor's installer creates them.

CREATE TABLE note (
    id              uuid        NOT NULL PRIMARY KEY,
    organization_id uuid        NOT NULL,
    item_id         uuid        NOT NULL,
    writer_id       uuid        NOT NULL,
    body            text        NOT NULL,
    created_at      timestamptz NOT NULL,
    updated_at      timestamptz NOT NULL
);

COMMENT ON TABLE note IS 'A note on a catalog item. Read only by changing actions; screens read note_versions.';
COMMENT ON COLUMN note.id IS 'The note.';
COMMENT ON COLUMN note.organization_id IS 'The organization the note belongs to.';
COMMENT ON COLUMN note.item_id IS 'The catalog item the note is about.';
COMMENT ON COLUMN note.writer_id IS 'The member of the organization who wrote the note.';
COMMENT ON COLUMN note.body IS 'The text of the note.';
COMMENT ON COLUMN note.created_at IS 'When the note was created.';
COMMENT ON COLUMN note.updated_at IS 'When the note was last changed.';

CREATE TABLE note_versions (
    organization_id  uuid        NOT NULL,
    id               uuid        NOT NULL,
    valid_from_at    timestamptz NOT NULL,
    valid_to_at      timestamptz NULL,
    valid_during     tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id        uuid        NULL,
    operation        text        NOT NULL,
    closed_by        uuid        NULL,
    closed_operation text        NULL,
    item_id          uuid        NOT NULL,
    writer_id        uuid        NOT NULL,
    body             text        NOT NULL,
    created_at       timestamptz NOT NULL,
    updated_at       timestamptz NOT NULL,
    PRIMARY KEY (organization_id, id, valid_from_at),
    CONSTRAINT note_versions_no_overlap
        EXCLUDE USING gist (organization_id WITH =, id WITH =, valid_during WITH &&)
);

COMMENT ON TABLE note_versions IS 'Every state a note has had, each with the period it was in force.';
COMMENT ON COLUMN note_versions.organization_id IS 'The organization the note belongs to.';
COMMENT ON COLUMN note_versions.id IS 'The note; the same in all its versions.';
COMMENT ON COLUMN note_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN note_versions.valid_to_at IS 'The change time from which it is not; NULL while it is in force now.';
COMMENT ON COLUMN note_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN note_versions.author_id IS 'Who opened the version; NULL for a system operation.';
COMMENT ON COLUMN note_versions.operation IS 'The action or system operation that opened the version.';
COMMENT ON COLUMN note_versions.closed_by IS 'Who closed the version; NULL while it is open.';
COMMENT ON COLUMN note_versions.closed_operation IS 'The action that closed the version; NULL while it is open.';
COMMENT ON COLUMN note_versions.item_id IS 'The catalog item the note is about.';
COMMENT ON COLUMN note_versions.writer_id IS 'The member of the organization who wrote the note.';
COMMENT ON COLUMN note_versions.body IS 'The text of the note.';
COMMENT ON COLUMN note_versions.created_at IS 'When the note was created.';
COMMENT ON COLUMN note_versions.updated_at IS 'When the note was last changed.';

-- The read path of the notes of an item at a moment: open versions, then versions closed after the moment.
CREATE INDEX note_versions_item ON note_versions (organization_id, item_id, valid_to_at);
COMMENT ON INDEX note_versions_item IS 'Reads the notes of an item at a moment.';

-- The watermark and the list of changes: the last opening and the last closing of the organization.
CREATE INDEX note_versions_from ON note_versions (organization_id, valid_from_at);
COMMENT ON INDEX note_versions_from IS 'Finds the last version opened in an organization.';

CREATE INDEX note_versions_to ON note_versions (organization_id, valid_to_at) WHERE valid_to_at IS NOT NULL;
COMMENT ON INDEX note_versions_to IS 'Finds the last version closed in an organization; partial, so open versions are not scanned.';
