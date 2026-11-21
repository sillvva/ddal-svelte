-- Roles the migrations grant to. They came from Supabase, which pre-creates them; plain Postgres
-- does not. Nothing logs in as these roles (the app connects as `postgres`), so they are NOLOGIN.
-- Idempotent. Run as a superuser before the migrations, on any fresh database (local or production).
DO $$
DECLARE
	r text;
BEGIN
	FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
		IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
			EXECUTE format('CREATE ROLE %I NOLOGIN', r);
		END IF;
	END LOOP;
END
$$;
