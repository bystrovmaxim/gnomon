-- 0002_account_place.sql — the account's last place (issue #13, spec 086): the organization and the page the
-- account had open last, so signing in opens it again. Runs as maxitor_core with search_path = platform, extensions.
-- The interface's state, not history: one row per account, overwritten on every change, no version table.

CREATE TABLE account_place (
    account_id uuid        NOT NULL PRIMARY KEY REFERENCES account (id),
    address    text        NOT NULL,
    changed_at timestamptz NOT NULL,
    CONSTRAINT account_place_address CHECK (address ~ '^/w/')
);
COMMENT ON TABLE account_place IS 'Where the account stopped: the address Maxitor opens after signing in; mechanics of the interface, without versions.';
COMMENT ON COLUMN account_place.account_id IS 'The account.';
COMMENT ON COLUMN account_place.address IS 'The last address of Maxitor the account had open, under /w/, without the time scale''s moment and comparison.';
COMMENT ON COLUMN account_place.changed_at IS 'When the account last moved.';
