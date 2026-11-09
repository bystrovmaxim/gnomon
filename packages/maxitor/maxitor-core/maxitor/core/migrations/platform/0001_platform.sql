-- 0001_platform.sql — the schema platform: accounts, their ways in, one-time codes and wrong-password attempts.
-- Runs as maxitor_core with search_path = platform, extensions; no name below says its schema.
-- Identifiers are written by the actions (no DEFAULT); nothing cascades; every column is described.

CREATE TABLE account (
    id                 uuid        NOT NULL PRIMARY KEY,
    name               text        NOT NULL,
    email              text        NOT NULL,
    policy_version     integer     NOT NULL,
    policy_accepted_at timestamptz NOT NULL,
    policy_accepted_ip inet        NOT NULL,
    created_at         timestamptz NOT NULL,
    updated_at         timestamptz NULL,
    CONSTRAINT account_email_lower CHECK (email = lower(email))
);
COMMENT ON TABLE account IS 'One person in Maxitor; exists only after they accepted the privacy policy.';
COMMENT ON COLUMN account.id IS 'The account.';
COMMENT ON COLUMN account.name IS 'The person''s name, from the provider or typed on the consent step.';
COMMENT ON COLUMN account.email IS 'The email the first sign-in gave, in lower case.';
COMMENT ON COLUMN account.policy_version IS 'The version of the privacy policy the person accepted last.';
COMMENT ON COLUMN account.policy_accepted_at IS 'When that version was accepted.';
COMMENT ON COLUMN account.policy_accepted_ip IS 'The IP address the acceptance came from.';
COMMENT ON COLUMN account.created_at IS 'When the account was created.';
COMMENT ON COLUMN account.updated_at IS 'When the account last changed; NULL if never.';

CREATE TABLE account_versions (
    id                 uuid        NOT NULL,
    valid_from_at      timestamptz NOT NULL,
    valid_to_at        timestamptz NULL,
    valid_during       tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id          uuid        NULL,
    operation          text        NOT NULL,
    closed_by          uuid        NULL,
    closed_operation   text        NULL,
    name               text        NOT NULL,
    email              text        NOT NULL,
    policy_version     integer     NOT NULL,
    policy_accepted_at timestamptz NOT NULL,
    policy_accepted_ip inet        NOT NULL,
    created_at         timestamptz NOT NULL,
    updated_at         timestamptz NULL,
    PRIMARY KEY (id, valid_from_at),
    CONSTRAINT account_versions_no_overlap EXCLUDE USING gist (id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE account_versions IS 'Every state an account has had, each with the period it was in force.';
COMMENT ON COLUMN account_versions.id IS 'The account; the same in all its versions.';
COMMENT ON COLUMN account_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN account_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN account_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN account_versions.author_id IS 'The account that opened the version; NULL for a system operation.';
COMMENT ON COLUMN account_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN account_versions.closed_by IS 'The account that closed the version; NULL while open.';
COMMENT ON COLUMN account_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN account_versions.name IS 'The person''s name in this version.';
COMMENT ON COLUMN account_versions.email IS 'The account''s email in this version.';
COMMENT ON COLUMN account_versions.policy_version IS 'The policy version accepted in this version.';
COMMENT ON COLUMN account_versions.policy_accepted_at IS 'When it was accepted.';
COMMENT ON COLUMN account_versions.policy_accepted_ip IS 'The IP the acceptance came from.';
COMMENT ON COLUMN account_versions.created_at IS 'When the account was created.';
COMMENT ON COLUMN account_versions.updated_at IS 'When the account last changed before this version; NULL if never.';

CREATE TABLE sign_in (
    id                  uuid        NOT NULL PRIMARY KEY,
    account_id          uuid        NOT NULL REFERENCES account (id),
    provider            text        NOT NULL,
    provider_subject    text        NOT NULL,
    email               text        NULL,
    password_hash       text        NULL,
    password_changed_at timestamptz NULL,
    added_country       char(2)     NULL,
    added_ip            inet        NOT NULL,
    added_at            timestamptz NOT NULL,
    last_used_at        timestamptz NULL,
    CONSTRAINT sign_in_provider CHECK (provider IN ('email', 'yandex', 'mailru', 'google', 'github', 'facebook')),
    CONSTRAINT sign_in_once UNIQUE (provider, provider_subject),
    CONSTRAINT sign_in_password_only_email CHECK (password_hash IS NULL OR provider = 'email')
);
COMMENT ON TABLE sign_in IS 'One way an account gets in: an email and password, or one provider''s account.';
COMMENT ON COLUMN sign_in.id IS 'The sign-in.';
COMMENT ON COLUMN sign_in.account_id IS 'The account this way in belongs to.';
COMMENT ON COLUMN sign_in.provider IS 'The way in: email, yandex, mailru, google, github or facebook.';
COMMENT ON COLUMN sign_in.provider_subject IS 'The provider''s id of the person; for email, the address in lower case.';
COMMENT ON COLUMN sign_in.email IS 'The email the provider gave; NULL if it gave none.';
COMMENT ON COLUMN sign_in.password_hash IS 'The Argon2id hash of the password, only for email; never kept in history.';
COMMENT ON COLUMN sign_in.password_changed_at IS 'When the password was last set; a session issued before it is not renewed.';
COMMENT ON COLUMN sign_in.added_country IS 'The country of the IP it was added from, ISO 3166-1 alpha-2; NULL if unknown.';
COMMENT ON COLUMN sign_in.added_ip IS 'The IP address it was added from.';
COMMENT ON COLUMN sign_in.added_at IS 'When it was added.';
COMMENT ON COLUMN sign_in.last_used_at IS 'When it last signed the account in; NULL if never since added.';
CREATE INDEX sign_in_account ON sign_in (account_id);
COMMENT ON INDEX sign_in_account IS 'Lists an account''s ways in.';

CREATE TABLE sign_in_versions (
    id                  uuid        NOT NULL,
    valid_from_at       timestamptz NOT NULL,
    valid_to_at         timestamptz NULL,
    valid_during        tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id           uuid        NULL,
    operation           text        NOT NULL,
    closed_by           uuid        NULL,
    closed_operation    text        NULL,
    account_id          uuid        NOT NULL,
    provider            text        NOT NULL,
    provider_subject    text        NOT NULL,
    email               text        NULL,
    password_changed_at timestamptz NULL,
    added_country       char(2)     NULL,
    added_ip            inet        NOT NULL,
    added_at            timestamptz NOT NULL,
    PRIMARY KEY (id, valid_from_at),
    CONSTRAINT sign_in_versions_no_overlap EXCLUDE USING gist (id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE sign_in_versions IS 'Every state a way in has had; the password hash is never kept here.';
COMMENT ON COLUMN sign_in_versions.id IS 'The sign-in; the same in all its versions.';
COMMENT ON COLUMN sign_in_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN sign_in_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN sign_in_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN sign_in_versions.author_id IS 'The account that opened the version; NULL for a system operation.';
COMMENT ON COLUMN sign_in_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN sign_in_versions.closed_by IS 'The account that closed the version; NULL while open.';
COMMENT ON COLUMN sign_in_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN sign_in_versions.account_id IS 'The account the way in belongs to.';
COMMENT ON COLUMN sign_in_versions.provider IS 'The way in.';
COMMENT ON COLUMN sign_in_versions.provider_subject IS 'The provider''s id of the person.';
COMMENT ON COLUMN sign_in_versions.email IS 'The email the provider gave; NULL if none.';
COMMENT ON COLUMN sign_in_versions.password_changed_at IS 'When the password was last set; NULL for a provider.';
COMMENT ON COLUMN sign_in_versions.added_country IS 'The country it was added from; NULL if unknown.';
COMMENT ON COLUMN sign_in_versions.added_ip IS 'The IP it was added from.';
COMMENT ON COLUMN sign_in_versions.added_at IS 'When it was added.';

CREATE TABLE sign_in_code (
    id                uuid        NOT NULL PRIMARY KEY,
    purpose           text        NOT NULL,
    email             text        NOT NULL,
    code_hash         text        NOT NULL,
    password_hash     text        NULL,
    wrong_tries       integer     NOT NULL,
    requested_country char(2)     NULL,
    requested_ip      inet        NOT NULL,
    created_at        timestamptz NOT NULL,
    expires_at        timestamptz NOT NULL,
    used_at           timestamptz NULL,
    CONSTRAINT sign_in_code_purpose CHECK (purpose IN ('confirm_email', 'reset_password')),
    CONSTRAINT sign_in_code_tries CHECK (wrong_tries BETWEEN 0 AND 5),
    CONSTRAINT sign_in_code_password_only_confirm CHECK (password_hash IS NULL OR purpose = 'confirm_email')
);
COMMENT ON TABLE sign_in_code IS 'A one-time code sent to an email; not versioned, deleted an hour after its end.';
COMMENT ON COLUMN sign_in_code.id IS 'The code.';
COMMENT ON COLUMN sign_in_code.purpose IS 'What the code is for: confirm_email or reset_password.';
COMMENT ON COLUMN sign_in_code.email IS 'The address the code was sent to, in lower case.';
COMMENT ON COLUMN sign_in_code.code_hash IS 'The hash of the six-digit code; the code itself is never stored.';
COMMENT ON COLUMN sign_in_code.password_hash IS 'For confirm_email: the hash of the password chosen at sign-up; NULL otherwise.';
COMMENT ON COLUMN sign_in_code.wrong_tries IS 'How many wrong codes were entered; the fifth ends the code.';
COMMENT ON COLUMN sign_in_code.requested_country IS 'The country of the IP that asked for it; NULL if unknown.';
COMMENT ON COLUMN sign_in_code.requested_ip IS 'The IP address that asked for it.';
COMMENT ON COLUMN sign_in_code.created_at IS 'When it was sent.';
COMMENT ON COLUMN sign_in_code.expires_at IS 'When it stops working: ten minutes after sending.';
COMMENT ON COLUMN sign_in_code.used_at IS 'When it ended: used, replaced or exhausted; NULL while it works.';
CREATE UNIQUE INDEX sign_in_code_one_open ON sign_in_code (email, purpose) WHERE used_at IS NULL;
COMMENT ON INDEX sign_in_code_one_open IS 'At most one working code per address and purpose.';
CREATE INDEX sign_in_code_email_time ON sign_in_code (email, created_at);
COMMENT ON INDEX sign_in_code_email_time IS 'Counts an address''s codes for the limits.';
CREATE INDEX sign_in_code_ip_time ON sign_in_code (requested_ip, created_at);
COMMENT ON INDEX sign_in_code_ip_time IS 'Counts an IP''s codes for the limit.';

CREATE TABLE sign_in_attempt (
    id    uuid        NOT NULL PRIMARY KEY,
    email text        NOT NULL,
    ip    inet        NOT NULL,
    at    timestamptz NOT NULL
);
COMMENT ON TABLE sign_in_attempt IS 'A wrong email or password; kept fifteen minutes to count the limits, not versioned.';
COMMENT ON COLUMN sign_in_attempt.id IS 'The attempt.';
COMMENT ON COLUMN sign_in_attempt.email IS 'The address entered, in lower case.';
COMMENT ON COLUMN sign_in_attempt.ip IS 'The IP address the attempt came from.';
COMMENT ON COLUMN sign_in_attempt.at IS 'When the attempt was made.';
CREATE INDEX sign_in_attempt_email_time ON sign_in_attempt (email, at);
COMMENT ON INDEX sign_in_attempt_email_time IS 'Counts an address''s wrong passwords.';
CREATE INDEX sign_in_attempt_ip_time ON sign_in_attempt (ip, at);
COMMENT ON INDEX sign_in_attempt_ip_time IS 'Counts an IP''s wrong passwords.';
