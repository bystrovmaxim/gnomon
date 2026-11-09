-- 0001_organization.sql — the schema organization: organizations, their users and boundaries.
-- Runs as maxitor_core with search_path = organization, platform, extensions; no name below says its schema,
-- so "account" resolves to the table of the schema platform. Every table carries organization_id; nothing cascades.

CREATE TABLE organization (
    id         uuid        NOT NULL PRIMARY KEY,
    name       text        NOT NULL,
    code       text        NOT NULL,
    created_by uuid        NOT NULL REFERENCES account (id),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NULL,
    CONSTRAINT organization_code_unique UNIQUE (code),
    CONSTRAINT organization_code_shape CHECK (code ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$')
);
COMMENT ON TABLE organization IS 'A tenant of Maxitor at /w/<code>.';
COMMENT ON COLUMN organization.id IS 'The organization.';
COMMENT ON COLUMN organization.name IS 'The organization''s name.';
COMMENT ON COLUMN organization.code IS 'The address code: lower-case ASCII letters, digits and hyphens, 2-63, unique.';
COMMENT ON COLUMN organization.created_by IS 'The account that registered it; counts the limit of ten per account.';
COMMENT ON COLUMN organization.created_at IS 'When it was registered.';
COMMENT ON COLUMN organization.updated_at IS 'When it last changed; NULL if never.';
CREATE INDEX organization_created_by ON organization (created_by);
COMMENT ON INDEX organization_created_by IS 'Counts the organizations an account registered.';

CREATE TABLE organization_versions (
    organization_id  uuid        NOT NULL,
    valid_from_at    timestamptz NOT NULL,
    valid_to_at      timestamptz NULL,
    valid_during     tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id        uuid        NULL,
    operation        text        NOT NULL,
    closed_by        uuid        NULL,
    closed_operation text        NULL,
    name             text        NOT NULL,
    code             text        NOT NULL,
    created_by       uuid        NOT NULL,
    created_at       timestamptz NOT NULL,
    updated_at       timestamptz NULL,
    PRIMARY KEY (organization_id, valid_from_at),
    CONSTRAINT organization_versions_no_overlap EXCLUDE USING gist (organization_id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE organization_versions IS 'Every state an organization has had, each with the period it was in force.';
COMMENT ON COLUMN organization_versions.organization_id IS 'The organization; the same in all its versions.';
COMMENT ON COLUMN organization_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN organization_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN organization_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN organization_versions.author_id IS 'The user who opened the version; NULL for a system operation.';
COMMENT ON COLUMN organization_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN organization_versions.closed_by IS 'The user who closed the version; NULL while open.';
COMMENT ON COLUMN organization_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN organization_versions.name IS 'The organization''s name in this version.';
COMMENT ON COLUMN organization_versions.code IS 'Its address code.';
COMMENT ON COLUMN organization_versions.created_by IS 'The account that registered it.';
COMMENT ON COLUMN organization_versions.created_at IS 'When it was registered.';
COMMENT ON COLUMN organization_versions.updated_at IS 'When it last changed before this version; NULL if never.';
CREATE INDEX organization_versions_to ON organization_versions (organization_id, valid_to_at) WHERE valid_to_at IS NOT NULL;
COMMENT ON INDEX organization_versions_to IS 'Finds the last version closed in an organization.';

CREATE TABLE "user" (
    organization_id uuid        NOT NULL REFERENCES organization (id),
    id              uuid        NOT NULL,
    account_id      uuid        NOT NULL REFERENCES account (id),
    name            text        NOT NULL,
    is_admin        boolean     NOT NULL,
    status          text        NOT NULL,
    created_at      timestamptz NOT NULL,
    updated_at      timestamptz NULL,
    PRIMARY KEY (organization_id, id),
    CONSTRAINT user_once_per_account UNIQUE (organization_id, account_id),
    CONSTRAINT user_status CHECK (status IN ('active', 'blocked', 'removed'))
);
COMMENT ON TABLE "user" IS 'An account''s place in exactly one organization.';
COMMENT ON COLUMN "user".organization_id IS 'The organization the user belongs to.';
COMMENT ON COLUMN "user".id IS 'The user.';
COMMENT ON COLUMN "user".account_id IS 'The account behind the user.';
COMMENT ON COLUMN "user".name IS 'The user''s name in this organization.';
COMMENT ON COLUMN "user".is_admin IS 'Whether the user administers the organization.';
COMMENT ON COLUMN "user".status IS 'The user''s state: active, blocked or removed.';
COMMENT ON COLUMN "user".created_at IS 'When the user was created.';
COMMENT ON COLUMN "user".updated_at IS 'When the user last changed; NULL if never.';
CREATE INDEX user_account ON "user" (account_id);
COMMENT ON INDEX user_account IS 'Finds an account''s users across organizations.';

CREATE TABLE user_versions (
    organization_id  uuid        NOT NULL,
    id               uuid        NOT NULL,
    valid_from_at    timestamptz NOT NULL,
    valid_to_at      timestamptz NULL,
    valid_during     tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id        uuid        NULL,
    operation        text        NOT NULL,
    closed_by        uuid        NULL,
    closed_operation text        NULL,
    account_id       uuid        NOT NULL,
    name             text        NOT NULL,
    is_admin         boolean     NOT NULL,
    status           text        NOT NULL,
    created_at       timestamptz NOT NULL,
    updated_at       timestamptz NULL,
    PRIMARY KEY (organization_id, id, valid_from_at),
    CONSTRAINT user_versions_no_overlap EXCLUDE USING gist (organization_id WITH =, id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE user_versions IS 'Every state a user has had, each with the period it was in force.';
COMMENT ON COLUMN user_versions.organization_id IS 'The organization the user belongs to.';
COMMENT ON COLUMN user_versions.id IS 'The user; the same in all its versions.';
COMMENT ON COLUMN user_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN user_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN user_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN user_versions.author_id IS 'The user who opened the version; NULL for a system operation.';
COMMENT ON COLUMN user_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN user_versions.closed_by IS 'The user who closed the version; NULL while open.';
COMMENT ON COLUMN user_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN user_versions.account_id IS 'The account behind the user.';
COMMENT ON COLUMN user_versions.name IS 'The user''s name in this version.';
COMMENT ON COLUMN user_versions.is_admin IS 'Whether the user administered the organization.';
COMMENT ON COLUMN user_versions.status IS 'The user''s state.';
COMMENT ON COLUMN user_versions.created_at IS 'When the user was created.';
COMMENT ON COLUMN user_versions.updated_at IS 'When the user last changed before this version; NULL if never.';

CREATE TABLE boundary (
    organization_id uuid        NOT NULL REFERENCES organization (id),
    id              uuid        NOT NULL,
    name            text        NOT NULL,
    created_at      timestamptz NOT NULL,
    updated_at      timestamptz NULL,
    PRIMARY KEY (organization_id, id)
);
COMMENT ON TABLE boundary IS 'All of ours that serves one end-to-end business process; plugins hang their data on it.';
COMMENT ON COLUMN boundary.organization_id IS 'The organization the boundary belongs to.';
COMMENT ON COLUMN boundary.id IS 'The boundary.';
COMMENT ON COLUMN boundary.name IS 'The boundary''s name.';
COMMENT ON COLUMN boundary.created_at IS 'When the boundary was created.';
COMMENT ON COLUMN boundary.updated_at IS 'When it last changed; NULL if never.';

CREATE TABLE boundary_versions (
    organization_id  uuid        NOT NULL,
    id               uuid        NOT NULL,
    valid_from_at    timestamptz NOT NULL,
    valid_to_at      timestamptz NULL,
    valid_during     tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id        uuid        NULL,
    operation        text        NOT NULL,
    closed_by        uuid        NULL,
    closed_operation text        NULL,
    name             text        NOT NULL,
    created_at       timestamptz NOT NULL,
    updated_at       timestamptz NULL,
    PRIMARY KEY (organization_id, id, valid_from_at),
    CONSTRAINT boundary_versions_no_overlap EXCLUDE USING gist (organization_id WITH =, id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE boundary_versions IS 'Every state a boundary has had, each with the period it was in force.';
COMMENT ON COLUMN boundary_versions.organization_id IS 'The organization the boundary belongs to.';
COMMENT ON COLUMN boundary_versions.id IS 'The boundary; the same in all its versions.';
COMMENT ON COLUMN boundary_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN boundary_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN boundary_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN boundary_versions.author_id IS 'The user who opened the version; NULL for a system operation.';
COMMENT ON COLUMN boundary_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN boundary_versions.closed_by IS 'The user who closed the version; NULL while open.';
COMMENT ON COLUMN boundary_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN boundary_versions.name IS 'The boundary''s name in this version.';
COMMENT ON COLUMN boundary_versions.created_at IS 'When the boundary was created.';
COMMENT ON COLUMN boundary_versions.updated_at IS 'When it last changed before this version; NULL if never.';

CREATE TABLE boundary_user (
    organization_id uuid NOT NULL,
    boundary_id     uuid NOT NULL,
    user_id         uuid NOT NULL,
    PRIMARY KEY (organization_id, boundary_id, user_id),
    FOREIGN KEY (organization_id, boundary_id) REFERENCES boundary (organization_id, id),
    FOREIGN KEY (organization_id, user_id) REFERENCES "user" (organization_id, id)
);
COMMENT ON TABLE boundary_user IS 'Which users work in which boundaries.';
COMMENT ON COLUMN boundary_user.organization_id IS 'The organization of both.';
COMMENT ON COLUMN boundary_user.boundary_id IS 'The boundary.';
COMMENT ON COLUMN boundary_user.user_id IS 'The user who works in it.';

CREATE TABLE boundary_user_versions (
    organization_id  uuid        NOT NULL,
    boundary_id      uuid        NOT NULL,
    user_id          uuid        NOT NULL,
    valid_from_at    timestamptz NOT NULL,
    valid_to_at      timestamptz NULL,
    valid_during     tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id        uuid        NULL,
    operation        text        NOT NULL,
    closed_by        uuid        NULL,
    closed_operation text        NULL,
    PRIMARY KEY (organization_id, boundary_id, user_id, valid_from_at),
    CONSTRAINT boundary_user_versions_no_overlap
        EXCLUDE USING gist (organization_id WITH =, boundary_id WITH =, user_id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE boundary_user_versions IS 'When each user worked in each boundary.';
COMMENT ON COLUMN boundary_user_versions.organization_id IS 'The organization of both.';
COMMENT ON COLUMN boundary_user_versions.boundary_id IS 'The boundary.';
COMMENT ON COLUMN boundary_user_versions.user_id IS 'The user.';
COMMENT ON COLUMN boundary_user_versions.valid_from_at IS 'The change time from which the link is in force.';
COMMENT ON COLUMN boundary_user_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN boundary_user_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN boundary_user_versions.author_id IS 'The user who opened the link; NULL for a system operation.';
COMMENT ON COLUMN boundary_user_versions.operation IS 'The action that opened the link.';
COMMENT ON COLUMN boundary_user_versions.closed_by IS 'The user who closed the link; NULL while open.';
COMMENT ON COLUMN boundary_user_versions.closed_operation IS 'The action that closed the link; NULL while open.';
