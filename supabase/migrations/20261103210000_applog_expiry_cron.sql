-- Deletes app logs with a daily pg_cron job instead of a trigger on every insert.
--
-- The old `delete_expired_applogs` trigger ran after each insert and kept 7 days. The job keeps
-- 14 days and runs at 04:30 UTC, half an hour after `delete-expired-log-drafts`.
--
-- Safe to run again: the trigger and function are dropped if they exist and recreated, and
-- `cron.schedule` with a job name replaces an existing job of that name.

create extension if not exists pg_cron with schema pg_catalog;

drop trigger if exists delete_expired_applogs on public.applog;

-- The trigger version returns `trigger`, which `create or replace` can't change.
drop function if exists public.delete_expired_applogs();

-- `applog.timestamp` has no time zone. The app writes it in UTC.
create function public.delete_expired_applogs()
returns integer
language sql
set search_path = ''
as $$
	with deleted as (
		delete from public.applog
		where "timestamp" <= (now() at time zone 'utc') - interval '14 days'
		returning 1
	)
	select count(*)::integer from deleted;
$$;

-- Supabase grants new functions in `public` to its API roles. Only the job (and the owner) runs this.
revoke execute on function public.delete_expired_applogs() from public, anon, authenticated, service_role;

select cron.schedule('delete-expired-applogs', '30 4 * * *', 'select public.delete_expired_applogs()');
