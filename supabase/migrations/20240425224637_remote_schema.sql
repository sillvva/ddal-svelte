revoke delete on table "public"."profile" from "anon";

revoke insert on table "public"."profile" from "anon";

revoke references on table "public"."profile" from "anon";

revoke select on table "public"."profile" from "anon";

revoke trigger on table "public"."profile" from "anon";

revoke truncate on table "public"."profile" from "anon";

revoke update on table "public"."profile" from "anon";

revoke delete on table "public"."profile" from "authenticated";

revoke insert on table "public"."profile" from "authenticated";

revoke references on table "public"."profile" from "authenticated";

revoke select on table "public"."profile" from "authenticated";

revoke trigger on table "public"."profile" from "authenticated";

revoke truncate on table "public"."profile" from "authenticated";

revoke update on table "public"."profile" from "authenticated";

revoke delete on table "public"."profile" from "service_role";

revoke insert on table "public"."profile" from "service_role";

revoke references on table "public"."profile" from "service_role";

revoke select on table "public"."profile" from "service_role";

revoke trigger on table "public"."profile" from "service_role";

revoke truncate on table "public"."profile" from "service_role";

revoke update on table "public"."profile" from "service_role";

alter table "public"."profile" drop constraint "public_profile_provider_providerAccountId_fkey";

alter table "public"."profile" drop constraint "profile_pkey";

drop index if exists "public"."profile_pkey";

drop index if exists "public"."profile_provider_providerAccountId_idx";

drop table "public"."profile";


