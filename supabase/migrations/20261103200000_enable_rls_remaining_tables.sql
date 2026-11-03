-- Turns on row-level security for the public tables that still had it off.
--
-- No policies are added, the same as `magicitem` and `storyaward`, so the Supabase API roles
-- (`anon`, `authenticated`) can't read or write these tables. The app connects as `postgres`, which
-- owns these tables and bypasses RLS. Their triggers and cleanup functions run as the caller, so they
-- keep working when the app or the `postgres`-owned pg_cron jobs fire them.
--
-- Enabling RLS on a table that already has it does nothing, so this file is safe to run again.

alter table public.applog enable row level security;
alter table public.image_upload enable row level security;
alter table public.log_image enable row level security;
alter table public.pending_object_deletion enable row level security;

do $$
declare
	missing text;
begin
	select string_agg(c.relname, ', ' order by c.relname)
	into missing
	from pg_class c
	join pg_namespace n on n.oid = c.relnamespace
	where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;

	if missing is not null then
		raise exception 'Row-level security is still off for public tables: %', missing;
	end if;
end;
$$;
