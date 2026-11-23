set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.delete_expired_sessions()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  with ranked as (
    select id,
      row_number() over (partition by "userId" order by expires desc) as rn
    from public.session
    where expires < (now() at time zone 'utc')
  ),
  deleted as (
    delete from public.session s
    using ranked r
    where s.id = r.id
      and r.rn > 1
      and s.expires < (now() at time zone 'utc') - interval '30 days'
    returning 1
  )
  select count(*)::integer from deleted;
$function$
;
