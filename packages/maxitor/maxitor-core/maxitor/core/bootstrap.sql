-- bootstrap.sql — run once by the database's administrator, never by the core.
-- Creates the core's role and its schemas, closes public and installs the extensions versioned storage needs.
-- psql variables: core_password (the role's password, from the environment, never written here).
--   psql "$ADMIN_DSN" -v core_password="$MAXITOR_CORE_PASSWORD" -f bootstrap.sql

CREATE ROLE maxitor_core LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'core_password';

REVOKE ALL ON SCHEMA public FROM PUBLIC;

CREATE SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO maxitor_core;
CREATE EXTENSION btree_gist SCHEMA extensions;

CREATE SCHEMA platform AUTHORIZATION maxitor_core;
CREATE SCHEMA organization AUTHORIZATION maxitor_core;

ALTER ROLE maxitor_core SET search_path = organization, platform, extensions;
