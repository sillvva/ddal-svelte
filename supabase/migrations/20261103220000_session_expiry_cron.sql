-- Deletes old sessions with a daily pg_cron job instead of a trigger on every insert or update.
--
-- Retention is unchanged: a session is deleted once it is more than 30 days past `expires`. The job
-- runs at 05:00 UTC, after `delete-expired-log-drafts` (04:00) and `delete-expired-applogs` (04:30).
--
-- Safe to run again: the trigger and function are dropped if they exist and recreated, and
-- `cron.schedule` with a job name replaces an existing job of that name.

create extension if not exists pg_cron with schema pg_catalog;

drop trigger if exists delete_expired_sessions_trigger on public.session;

-- The trigger version returns `trigger`, which `create or replace` can't change.
drop function if exists public.delete_expired_sessions();

-- `session.expires` has no time zone. The app writes it in UTC.
create function public.delete_expired_sessions()
returns integer
language sql
set search_path = ''
as $$
	with deleted as (
		delete from public.session
		where expires < (now() at time zone 'utc') - interval '30 days'
		returning 1
	)
	select count(*)::integer from deleted;
$$;

-- Supabase grants new functions in `public` to its API roles. Only the job (and the owner) runs this.
revoke execute on function public.delete_expired_sessions() from public, anon, authenticated, service_role;

select cron.schedule('delete-expired-sessions', '0 5 * * *', 'select public.delete_expired_sessions()');
