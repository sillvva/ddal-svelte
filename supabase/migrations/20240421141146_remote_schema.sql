alter table "public"."account" alter column "access_token" drop not null;

alter table "public"."account" alter column "expires_at" drop not null;

alter table "public"."account" alter column "id_token" set data type text using "id_token"::text;

alter table "public"."account" alter column "provider" set data type text using "provider"::text;

alter table "public"."account" alter column "providerAccountId" set data type text using "providerAccountId"::text;

alter table "public"."account" alter column "scope" drop not null;

alter table "public"."account" alter column "scope" set data type text using "scope"::text;

alter table "public"."account" alter column "session_state" set data type text using "session_state"::text;

alter table "public"."account" alter column "token_type" drop not null;

alter table "public"."account" alter column "token_type" set data type text using "token_type"::text;

alter table "public"."account" alter column "type" set data type text using "type"::text;

alter table "public"."account" alter column "userId" set data type text using "userId"::text;

alter table "public"."character" alter column "campaign" set data type text using "campaign"::text;

alter table "public"."character" alter column "character_sheet_url" set data type text using "character_sheet_url"::text;

alter table "public"."character" alter column "class" set data type text using "class"::text;

alter table "public"."character" alter column "id" set data type text using "id"::text;

alter table "public"."character" alter column "image_url" set data type text using "image_url"::text;

alter table "public"."character" alter column "name" set data type text using "name"::text;

alter table "public"."character" alter column "race" set data type text using "race"::text;

alter table "public"."character" alter column "userId" set data type text using "userId"::text;

alter table "public"."dungeonmaster" alter column "DCI" set data type text using "DCI"::text;

alter table "public"."dungeonmaster" alter column "id" set data type text using "id"::text;

alter table "public"."dungeonmaster" alter column "name" set data type text using "name"::text;

alter table "public"."dungeonmaster" alter column "owner" set data type text using "owner"::text;

alter table "public"."dungeonmaster" alter column "uid" set data type text using "uid"::text;

alter table "public"."log" alter column "characterId" set data type text using "characterId"::text;

alter table "public"."log" alter column "description" set data type text using "description"::text;

alter table "public"."log" alter column "dungeonMasterId" set data type text using "dungeonMasterId"::text;

alter table "public"."log" alter column "id" set data type text using "id"::text;

alter table "public"."log" alter column "name" set data type text using "name"::text;

alter table "public"."magicitem" alter column "id" set data type text using "id"::text;

alter table "public"."magicitem" alter column "logGainedId" set data type text using "logGainedId"::text;

alter table "public"."magicitem" alter column "logLostId" set data type text using "logLostId"::text;

alter table "public"."magicitem" alter column "name" set data type text using "name"::text;

alter table "public"."session" alter column "userId" set data type text using "userId"::text;

alter table "public"."storyaward" alter column "id" set data type text using "id"::text;

alter table "public"."storyaward" alter column "logGainedId" set data type text using "logGainedId"::text;

alter table "public"."storyaward" alter column "logLostId" set data type text using "logLostId"::text;

alter table "public"."storyaward" alter column "name" set data type text using "name"::text;

alter table "public"."user" alter column "email" set not null;

alter table "public"."user" alter column "email" set data type text using "email"::text;

alter table "public"."user" alter column "id" set data type text using "id"::text;

alter table "public"."user" alter column "name" drop not null;

alter table "public"."user" alter column "name" set data type text using "name"::text;

CREATE UNIQUE INDEX user_email_key ON public."user" USING btree (email);

alter table "public"."dungeonmaster" add constraint "dungeonmaster_DCI_check" CHECK ((length("DCI") < 12)) not valid;

alter table "public"."dungeonmaster" validate constraint "dungeonmaster_DCI_check";

alter table "public"."user" add constraint "user_email_key" UNIQUE using index "user_email_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.delete_expired_sessions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
  DELETE FROM "session" WHERE expires + interval '30' day < NOW();
  RETURN NEW;
END;$function$
;


