create type "public"."userRoles" as enum ('user', 'admin');

alter table "public"."session" add column "impersonated_by" uuid;

alter table "public"."user" add column "ban_expires" timestamp with time zone;

alter table "public"."user" add column "ban_reason" text default ''::text;

alter table "public"."user" add column "banned" boolean default false;

alter table "public"."user" add column "role" "userRoles" default 'user'::"userRoles";

alter table "public"."session" add constraint "public_session_impersonatedBy_fkey" FOREIGN KEY (impersonated_by) REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."session" validate constraint "public_session_impersonatedBy_fkey";


