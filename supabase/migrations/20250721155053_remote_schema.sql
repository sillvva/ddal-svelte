create type "public"."logLevel" as enum ('ALL', 'FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'OFF');

create table "public"."applog" (
    "id" uuid not null,
    "label" text not null,
    "level" "logLevel" not null,
    "annotations" jsonb not null,
    "timestamp" timestamp without time zone not null
);


CREATE UNIQUE INDEX applog_pkey ON public.applog USING btree (id);

alter table "public"."applog" add constraint "applog_pkey" PRIMARY KEY using index "applog_pkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.delete_expired_applogs()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
  DELETE FROM "applog" WHERE timestamp + interval '7' day < NOW();
  RETURN NEW;
END;$function$
;

grant delete on table "public"."applog" to "anon";

grant insert on table "public"."applog" to "anon";

grant references on table "public"."applog" to "anon";

grant select on table "public"."applog" to "anon";

grant trigger on table "public"."applog" to "anon";

grant truncate on table "public"."applog" to "anon";

grant update on table "public"."applog" to "anon";

grant delete on table "public"."applog" to "authenticated";

grant insert on table "public"."applog" to "authenticated";

grant references on table "public"."applog" to "authenticated";

grant select on table "public"."applog" to "authenticated";

grant trigger on table "public"."applog" to "authenticated";

grant truncate on table "public"."applog" to "authenticated";

grant update on table "public"."applog" to "authenticated";

grant delete on table "public"."applog" to "service_role";

grant insert on table "public"."applog" to "service_role";

grant references on table "public"."applog" to "service_role";

grant select on table "public"."applog" to "service_role";

grant trigger on table "public"."applog" to "service_role";

grant truncate on table "public"."applog" to "service_role";

grant update on table "public"."applog" to "service_role";

CREATE TRIGGER delete_expired_applogs AFTER INSERT ON public.applog FOR EACH STATEMENT EXECUTE FUNCTION delete_expired_applogs();


