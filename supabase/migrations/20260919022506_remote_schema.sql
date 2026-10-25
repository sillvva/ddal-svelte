alter table "public"."account" add column "password" text;

alter table "public"."account" add column "refresh_expires_at" timestamp with time zone;


