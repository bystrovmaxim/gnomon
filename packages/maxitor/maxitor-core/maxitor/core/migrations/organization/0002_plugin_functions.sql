-- 0002_plugin_functions.sql — what a plugin needs of the core, given by functions, never by tables (FR-025).
-- Runs as maxitor_core with search_path = organization, platform, extensions. Each function runs as its owner with a
-- fixed search_path, so a caller cannot redirect what it reads; only the group maxitor_plugin may execute them.

CREATE FUNCTION change_time(p_organization_id uuid) RETURNS timestamptz
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = organization, platform, plugins, extensions AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM organization WHERE id = p_organization_id) THEN
        RAISE EXCEPTION 'no organization %', p_organization_id USING ERRCODE = 'no_data_found';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('organization:' || p_organization_id::text));
    RETURN greatest(
        clock_timestamp(),
        coalesce(watermark(p_organization_id), '-infinity'::timestamptz) + interval '1 microsecond'
    );
END
$$;
COMMENT ON FUNCTION change_time(uuid) IS
    'Takes the organization''s lock for the rest of the transaction and answers its change time: the clock, or one microsecond after the organization''s last change in the core''s tables, whichever is later. A plugin takes the greatest of it and its own last change.';

CREATE FUNCTION watermark(p_organization_id uuid) RETURNS timestamptz
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
    ) AS changes;
    RETURN last_change;
END
$$;
COMMENT ON FUNCTION watermark(uuid) IS
    'The organization''s last change time in the core''s version tables; NULL when it never changed. A plugin takes the greatest of it and its own.';

CREATE FUNCTION is_member(p_organization_id uuid, p_account_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = organization, platform, extensions AS $$
    SELECT EXISTS (
        SELECT 1 FROM "user"
        WHERE organization_id = p_organization_id AND account_id = p_account_id AND status = 'active'
    )
$$;
COMMENT ON FUNCTION is_member(uuid, uuid) IS
    'Whether the account has an active user in the organization now; false for a blocked or removed user and for an organization that does not exist.';

CREATE FUNCTION member_organization(p_code text, p_account_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = organization, platform, extensions AS $$
    SELECT o.id FROM organization o JOIN "user" u ON u.organization_id = o.id
    WHERE o.code = p_code AND u.account_id = p_account_id AND u.status = 'active'
$$;
COMMENT ON FUNCTION member_organization(text, uuid) IS
    'The organization of an address code when the account has an active user there now; NULL otherwise, alike for a code that does not exist.';

CREATE FUNCTION member_name(p_organization_id uuid, p_account_id uuid, p_at timestamptz) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = organization, platform, extensions AS $$
    SELECT name FROM user_versions
    WHERE organization_id = p_organization_id AND account_id = p_account_id
        AND valid_from_at <= p_at AND (valid_to_at IS NULL OR valid_to_at > p_at)
$$;
COMMENT ON FUNCTION member_name(uuid, uuid, timestamptz) IS
    'The name of the account''s user in the organization at a moment; NULL when it had none then.';

REVOKE ALL ON FUNCTION change_time(uuid), watermark(uuid), is_member(uuid, uuid), member_organization(text, uuid),
    member_name(uuid, uuid, timestamptz) FROM PUBLIC;
GRANT USAGE ON SCHEMA organization TO maxitor_plugin;
GRANT EXECUTE ON FUNCTION change_time(uuid), watermark(uuid), is_member(uuid, uuid), member_organization(text, uuid),
    member_name(uuid, uuid, timestamptz) TO maxitor_plugin;

-- The installer builds a plugin's keys to the core's users and organizations (foreign-keys.yaml): the database checks
-- such a key as the owner of the target table, so the plugin's user needs no right here at all.
GRANT REFERENCES (organization_id, id, account_id) ON "user" TO maxitor_installer;
GRANT REFERENCES (id) ON organization TO maxitor_installer;
