create type "public"."logType" as enum ('game', 'nongame');

alter table "public"."log" alter column "type" set data type "logType" using "type"::"logType";

alter table "public"."account" add column "last_login" timestamp with time zone;



