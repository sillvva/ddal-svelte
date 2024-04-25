revoke delete on table "public"."verificationtoken" from "anon";

revoke insert on table "public"."verificationtoken" from "anon";

revoke references on table "public"."verificationtoken" from "anon";

revoke select on table "public"."verificationtoken" from "anon";

revoke trigger on table "public"."verificationtoken" from "anon";

revoke truncate on table "public"."verificationtoken" from "anon";

revoke update on table "public"."verificationtoken" from "anon";

revoke delete on table "public"."verificationtoken" from "authenticated";

revoke insert on table "public"."verificationtoken" from "authenticated";

revoke references on table "public"."verificationtoken" from "authenticated";

revoke select on table "public"."verificationtoken" from "authenticated";

revoke trigger on table "public"."verificationtoken" from "authenticated";

revoke truncate on table "public"."verificationtoken" from "authenticated";

revoke update on table "public"."verificationtoken" from "authenticated";

revoke delete on table "public"."verificationtoken" from "service_role";

revoke insert on table "public"."verificationtoken" from "service_role";

revoke references on table "public"."verificationtoken" from "service_role";

revoke select on table "public"."verificationtoken" from "service_role";

revoke trigger on table "public"."verificationtoken" from "service_role";

revoke truncate on table "public"."verificationtoken" from "service_role";

revoke update on table "public"."verificationtoken" from "service_role";

alter table "public"."verificationtoken" drop constraint "verificationtoken_pkey";

drop index if exists "public"."verificationtoken_pkey";

drop table "public"."verificationtoken";

CREATE UNIQUE INDEX "profile_provider_providerAccountId_idx" ON public.profile USING btree (provider, "providerAccountId");


