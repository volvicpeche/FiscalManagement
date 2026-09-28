-- Minimal stand-in for what every Supabase project already has, so that the
-- migrations apply to a plain Postgres (CI, local tests). NEVER run this on
-- Supabase itself.
--
-- The migrations only reference auth.users (foreign keys) and the anon and
-- authenticated roles (REVOKE).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY
);
