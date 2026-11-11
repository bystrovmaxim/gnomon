-- packages/maxitor/maxitor-core/maxitor/core/migrations/organization/0003_organization_clock.sql
-- The organization's watermark follows every change of it, a plugin's too (spec 077, R7). A plugin's change takes
-- its time from change_time(), which now keeps that time in organization_clock in the same transaction; watermark()
-- reads it beside the core's version tables. So "now" moves for the frame and for every page when anyone changes
-- anything in the organization, and only once that change is committed.

CREATE TABLE organization_clock (
    organization_id uuid        NOT NULL,
    changed_at      timestamptz NOT NULL,
    PRIMARY KEY (organization_id),
    CONSTRAINT organization_clock_organization FOREIGN KEY (organization_id) REFERENCES organization (id)
);
COMMENT ON TABLE organization_clock IS 'The last change time change_time() gave in an organization; mechanics of work, without versions.';
COMMENT ON COLUMN organization_clock.organization_id IS 'The organization.';
COMMENT ON COLUMN organization_clock.changed_at IS 'The latest change time change_time() answered for it in a committed transaction.';

CREATE OR REPLACE FUNCTION change_time(p_organization_id uuid) RETURNS timestamptz
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = organization, platform, plugins, extensions AS $$
DECLARE
    changed timestamptz;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM organization WHERE id = p_organization_id) THEN
        RAISE EXCEPTION 'no organization %', p_organization_id USING ERRCODE = 'no_data_found';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('organization:' || p_organization_id::text));
    changed := greatest(
        clock_timestamp(),
        coalesce(watermark(p_organization_id), '-infinity'::timestamptz) + interval '1 microsecond'
    );
    INSERT INTO organization_clock (organization_id, changed_at) VALUES (p_organization_id, changed)
    ON CONFLICT (organization_id) DO UPDATE SET changed_at = greatest(organization_clock.changed_at, EXCLUDED.changed_at);
    RETURN changed;
END
$$;

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
    'The organization''s last committed change time: the core''s version tables and every change time change_time() gave, a plugin''s too; NULL when it never changed. Reading at it gives an answer that no longer changes.';
