-- Deletes log drafts once they expire, as a daily pg_cron job.
--
-- A draft expires 14 days after `updated_at` (`LOG_DRAFT_TTL_MS` in `src/lib/log-draft.ts`). The app
-- already treats expired rows as missing when it reads them, so this job only reclaims the space.
-- The job lives in the database, so every app instance sharing it relies on one schedule.
--
-- Safe to run again: the extension, function, and grants are idempotent, and `cron.schedule` with a
-- job name replaces an existing job of that name instead of adding a second one.

-- Supabase's own setup for pg_cron grants `postgres` what it needs. Extra grants on the `cron`
-- schema make that setup fail when this file runs again.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.delete_expired_log_drafts()
returns integer
language sql
set search_path = ''
as $$
	with deleted as (
		delete from public.log_draft
		where updated_at < now() - interval '14 days'
		returning 1
	)
	select count(*)::integer from deleted;
$$;

-- Supabase grants new functions in `public` to its API roles. Only the job (and the owner) runs this.
revoke execute on function public.delete_expired_log_drafts() from public, anon, authenticated, service_role;

select cron.schedule('delete-expired-log-drafts', '0 4 * * *', 'select public.delete_expired_log_drafts()');

-- The app connects as the table owner, which RLS does not apply to. With no policies, the Supabase
-- API roles can't read or write drafts, the same as `log` and `dungeonmaster`.
alter table public.log_draft enable row level security;
