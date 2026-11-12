-- 0004_invitations.sql — the setting "Who may invite", the invitation as an entity of its own, and a user unique
-- among the users not removed (issue #13, spec 086). Runs as maxitor_core with search_path = organization, platform,
-- extensions. Nothing cascades; identifiers are written by the actions.

-- Who may invite: any user of the organization, or administrators only. Every organization so far lets any user.
ALTER TABLE organization ADD COLUMN who_may_invite text NULL;
UPDATE organization SET who_may_invite = 'any_user';
ALTER TABLE organization ALTER COLUMN who_may_invite SET NOT NULL;
ALTER TABLE organization ADD CONSTRAINT organization_who_may_invite CHECK (who_may_invite IN ('any_user', 'administrators'));
COMMENT ON COLUMN organization.who_may_invite IS 'Who may invite: any_user, or administrators only. Registering sets any_user.';

ALTER TABLE organization_versions ADD COLUMN who_may_invite text NULL;
UPDATE organization_versions SET who_may_invite = 'any_user';
ALTER TABLE organization_versions ALTER COLUMN who_may_invite SET NOT NULL;
COMMENT ON COLUMN organization_versions.who_may_invite IS 'Who may invite in this version.';

-- A user is unique for an organization and an account among the users not removed: a removed person invited again
-- gets a new user, and the removed one stays in the history.
ALTER TABLE "user" DROP CONSTRAINT user_once_per_account;
CREATE UNIQUE INDEX user_once_among_not_removed ON "user" (organization_id, account_id) WHERE status <> 'removed';
COMMENT ON INDEX user_once_among_not_removed IS 'At most one user that is not removed per organization and account.';

CREATE TABLE invitation (
    organization_id  uuid        NOT NULL REFERENCES organization (id),
    id               uuid        NOT NULL,
    email            text        NOT NULL,
    invited_by       uuid        NOT NULL,
    is_admin         boolean     NOT NULL,
    status           text        NOT NULL,
    sent_at          timestamptz NOT NULL,
    letter_sent_at   timestamptz NOT NULL,
    expires_at       timestamptz NOT NULL,
    decided_at       timestamptz NULL,
    decided_by       uuid        NULL,
    by_setting       boolean     NOT NULL,
    accepted_user_id uuid        NULL,
    created_at       timestamptz NOT NULL,
    updated_at       timestamptz NULL,
    PRIMARY KEY (organization_id, id),
    CONSTRAINT invitation_id_unique UNIQUE (id),
    FOREIGN KEY (organization_id, invited_by) REFERENCES "user" (organization_id, id),
    FOREIGN KEY (organization_id, decided_by) REFERENCES "user" (organization_id, id),
    FOREIGN KEY (organization_id, accepted_user_id) REFERENCES "user" (organization_id, id),
    CONSTRAINT invitation_email_lower CHECK (email = lower(email)),
    CONSTRAINT invitation_status CHECK (status IN ('sent', 'accepted', 'declined', 'withdrawn', 'expired'))
);
COMMENT ON TABLE invitation IS 'The organization''s offer to one email: who sent it, whether it makes an administrator, and what became of it.';
COMMENT ON COLUMN invitation.organization_id IS 'The organization that invites.';
COMMENT ON COLUMN invitation.id IS 'The invitation; unique across Maxitor, so an account finds it by id alone.';
COMMENT ON COLUMN invitation.email IS 'The email the invitation was sent to, in lower case.';
COMMENT ON COLUMN invitation.invited_by IS 'The user who sent it.';
COMMENT ON COLUMN invitation.is_admin IS 'Whether accepting makes an administrator.';
COMMENT ON COLUMN invitation.status IS 'Its state: sent, accepted, declined, withdrawn or expired.';
COMMENT ON COLUMN invitation.sent_at IS 'When its first letter was sent.';
COMMENT ON COLUMN invitation.letter_sent_at IS 'When its last letter was sent: the first, or one sent again.';
COMMENT ON COLUMN invitation.expires_at IS 'When it expires: sent_at plus MAXITOR_INVITATION_DAYS days.';
COMMENT ON COLUMN invitation.decided_at IS 'When it left the state sent; NULL while sent.';
COMMENT ON COLUMN invitation.decided_by IS 'The administrator who withdrew it, or who switched the setting that withdrew it; NULL when the invited account or the time decided.';
COMMENT ON COLUMN invitation.by_setting IS 'Whether the setting Who may invite withdrew it.';
COMMENT ON COLUMN invitation.accepted_user_id IS 'The user accepting it made; NULL unless accepted.';
COMMENT ON COLUMN invitation.created_at IS 'When it was created: the same as sent_at.';
COMMENT ON COLUMN invitation.updated_at IS 'When it last changed; NULL if never.';
CREATE UNIQUE INDEX invitation_one_sent ON invitation (organization_id, email) WHERE status = 'sent';
COMMENT ON INDEX invitation_one_sent IS 'At most one invitation still sent per organization and email.';
CREATE INDEX invitation_email ON invitation (email) WHERE status = 'sent';
COMMENT ON INDEX invitation_email IS 'Finds the invitations an account''s emails match.';
CREATE INDEX invitation_inviter_time ON invitation (organization_id, invited_by, sent_at);
COMMENT ON INDEX invitation_inviter_time IS 'Counts an inviter''s invitations for the limit.';
CREATE INDEX invitation_organization_time ON invitation (organization_id, sent_at);
COMMENT ON INDEX invitation_organization_time IS 'Counts an organization''s invitations for the limit.';

CREATE TABLE invitation_versions (
    organization_id  uuid        NOT NULL,
    id               uuid        NOT NULL,
    valid_from_at    timestamptz NOT NULL,
    valid_to_at      timestamptz NULL,
    valid_during     tstzrange   GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED,
    author_id        uuid        NULL,
    operation        text        NOT NULL,
    closed_by        uuid        NULL,
    closed_operation text        NULL,
    email            text        NOT NULL,
    invited_by       uuid        NOT NULL,
    is_admin         boolean     NOT NULL,
    status           text        NOT NULL,
    sent_at          timestamptz NOT NULL,
    letter_sent_at   timestamptz NOT NULL,
    expires_at       timestamptz NOT NULL,
    decided_at       timestamptz NULL,
    decided_by       uuid        NULL,
    by_setting       boolean     NOT NULL,
    accepted_user_id uuid        NULL,
    created_at       timestamptz NOT NULL,
    updated_at       timestamptz NULL,
    PRIMARY KEY (organization_id, id, valid_from_at),
    CONSTRAINT invitation_versions_no_overlap EXCLUDE USING gist (organization_id WITH =, id WITH =, valid_during WITH &&)
);
COMMENT ON TABLE invitation_versions IS 'Every state an invitation has had, each with the period it was in force.';
COMMENT ON COLUMN invitation_versions.organization_id IS 'The organization that invites.';
COMMENT ON COLUMN invitation_versions.id IS 'The invitation; the same in all its versions.';
COMMENT ON COLUMN invitation_versions.valid_from_at IS 'The change time from which this version is in force.';
COMMENT ON COLUMN invitation_versions.valid_to_at IS 'The change time from which it is not; NULL while in force.';
COMMENT ON COLUMN invitation_versions.valid_during IS 'The period [valid_from_at, valid_to_at), for the overlap constraint.';
COMMENT ON COLUMN invitation_versions.author_id IS 'The user who opened the version; NULL for the invited account or a system operation.';
COMMENT ON COLUMN invitation_versions.operation IS 'The action that opened the version.';
COMMENT ON COLUMN invitation_versions.closed_by IS 'The user who closed the version; NULL while open.';
COMMENT ON COLUMN invitation_versions.closed_operation IS 'The action that closed the version; NULL while open.';
COMMENT ON COLUMN invitation_versions.email IS 'The email in this version.';
COMMENT ON COLUMN invitation_versions.invited_by IS 'The user who sent it.';
COMMENT ON COLUMN invitation_versions.is_admin IS 'Whether accepting makes an administrator.';
COMMENT ON COLUMN invitation_versions.status IS 'Its state in this version.';
COMMENT ON COLUMN invitation_versions.sent_at IS 'When its first letter was sent.';
COMMENT ON COLUMN invitation_versions.letter_sent_at IS 'When its last letter was sent as of this version.';
COMMENT ON COLUMN invitation_versions.expires_at IS 'When it expires.';
COMMENT ON COLUMN invitation_versions.decided_at IS 'When it left the state sent; NULL while sent.';
COMMENT ON COLUMN invitation_versions.decided_by IS 'The administrator who decided it; NULL when the invited account or the time did.';
COMMENT ON COLUMN invitation_versions.by_setting IS 'Whether the setting Who may invite withdrew it.';
COMMENT ON COLUMN invitation_versions.accepted_user_id IS 'The user accepting it made; NULL unless accepted.';
COMMENT ON COLUMN invitation_versions.created_at IS 'When it was created.';
COMMENT ON COLUMN invitation_versions.updated_at IS 'When it last changed before this version; NULL if never.';

-- One row per letter of invitation: the limits of letters to one address count them. Mechanics, not history: a row
-- is deleted an hour after the letter, once the hourly limit no longer counts it.
CREATE TABLE invitation_letter (
    id              uuid        NOT NULL PRIMARY KEY,
    organization_id uuid        NOT NULL,
    invitation_id   uuid        NOT NULL,
    email           text        NOT NULL,
    sent_at         timestamptz NOT NULL,
    FOREIGN KEY (organization_id, invitation_id) REFERENCES invitation (organization_id, id)
);
COMMENT ON TABLE invitation_letter IS 'One letter of invitation sent; kept an hour to count the limits of letters to one address.';
COMMENT ON COLUMN invitation_letter.id IS 'The letter.';
COMMENT ON COLUMN invitation_letter.organization_id IS 'The organization that invites.';
COMMENT ON COLUMN invitation_letter.invitation_id IS 'The invitation the letter belongs to.';
COMMENT ON COLUMN invitation_letter.email IS 'The address the letter went to, in lower case.';
COMMENT ON COLUMN invitation_letter.sent_at IS 'When it was handed to the mail.';
CREATE INDEX invitation_letter_email_time ON invitation_letter (email, sent_at);
COMMENT ON INDEX invitation_letter_email_time IS 'Counts an address''s letters of invitation for the limits.';

-- The organization's watermark follows its invitations too.
CREATE OR REPLACE FUNCTION watermark(p_organization_id uuid) RETURNS timestamptz
    LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = organization, platform, plugins, extensions AS $$
DECLARE
    last_change timestamptz;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM organization WHERE id = p_organization_id) THEN
        RAISE EXCEPTION 'no organization %', p_organization_id USING ERRCODE = 'no_data_found';
    END IF;
    SELECT max(t) INTO last_change FROM (
        SELECT max(valid_from_at) AS t FROM organization_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT max(valid_to_at) FROM organization_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT max(valid_from_at) FROM user_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT max(valid_to_at) FROM user_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT max(valid_from_at) FROM invitation_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT max(valid_to_at) FROM invitation_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT max(valid_from_at) FROM boundary_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT max(valid_to_at) FROM boundary_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT max(valid_from_at) FROM boundary_user_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT max(valid_to_at) FROM boundary_user_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT max(valid_from_at) FROM organization_plugin_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT max(valid_to_at) FROM organization_plugin_versions WHERE organization_id = p_organization_id
        UNION ALL SELECT changed_at FROM organization_clock WHERE organization_id = p_organization_id
    ) AS changes;
    RETURN last_change;
END
$$;
COMMENT ON FUNCTION watermark(uuid) IS
    'The organization''s last committed change time: the core''s version tables, the invitations'' included, and every change time change_time() gave, a plugin''s too; NULL when it never changed.';
