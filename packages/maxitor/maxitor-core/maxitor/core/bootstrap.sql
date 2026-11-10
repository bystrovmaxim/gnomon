-- bootstrap.sql — run once by the database's administrator, never by the core.
-- Creates the core's roles and schemas, closes public and installs the extensions versioned storage needs.
-- psql variables (from the environment, never written here):
--   core_password       the password of maxitor_core, the core's everyday role
--   installer_password  the password of maxitor_installer, which only the process maxitor-plugin-installer knows
--   psql "$ADMIN_DSN" -v core_password="$MAXITOR_CORE_PASSWORD" -v installer_password="$MAXITOR_INSTALLER_PASSWORD" -f bootstrap.sql

CREATE ROLE maxitor_core LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'core_password';

-- The installer creates a schema and a database user for every deployed plugin version. CREATEROLE in
-- PostgreSQL 16 lets it administer only the roles it creates: never a superuser, never maxitor_core.
CREATE ROLE maxitor_installer LOGIN NOSUPERUSER NOCREATEDB CREATEROLE PASSWORD :'installer_password';
DO $$ BEGIN EXECUTE format('GRANT CREATE ON DATABASE %I TO maxitor_installer', current_database()); END $$;

-- The group of every plugin version's user: the core's functions are granted to it, not to each user.
CREATE ROLE maxitor_plugin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT maxitor_plugin TO maxitor_installer WITH ADMIN OPTION;

REVOKE ALL ON SCHEMA public FROM PUBLIC;

CREATE SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO maxitor_core, maxitor_installer, maxitor_plugin;
CREATE EXTENSION btree_gist SCHEMA extensions;

CREATE SCHEMA platform AUTHORIZATION maxitor_core;
CREATE SCHEMA organization AUTHORIZATION maxitor_core;
CREATE SCHEMA plugins AUTHORIZATION maxitor_core;

ALTER ROLE maxitor_core SET search_path = organization, platform, plugins, extensions;
ALTER ROLE maxitor_installer SET search_path = plugins, organization, extensions;
