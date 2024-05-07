create type "public"."logType" as enum ('game', 'nongame');

alter table "public"."log" drop constraint "public_log_characterId_fkey";

alter table "public"."log" drop constraint "public_log_dungeonMasterId_fkey";

alter table "public"."account" alter column "access_token" set data type text using "access_token"::text;

alter table "public"."account" alter column "refresh_token" set data type text using "refresh_token"::text;

alter table "public"."session" alter column "sessionToken" set data type text using "sessionToken"::text;

alter table "public"."log" alter column "type" set data type "logType" using "type"::"logType";

alter table "public"."log" add constraint "public_log_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "character"(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."log" validate constraint "public_log_characterId_fkey";

alter table "public"."log" add constraint "public_log_dungeonMasterId_fkey" FOREIGN KEY ("dungeonMasterId") REFERENCES dungeonmaster(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."log" validate constraint "public_log_dungeonMasterId_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.delete_expired_sessions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
  DELETE FROM "session" WHERE expires + interval '30' day < NOW();
  RETURN NEW;
END;$function$
;


