alter table "public"."log" add column "timezone" text;

alter table "public"."log" alter column "date" drop default;


