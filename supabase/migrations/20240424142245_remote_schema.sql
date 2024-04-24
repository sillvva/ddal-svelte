alter table "public"."user" drop constraint "user_email_key";

drop index if exists "public"."user_email_key";

create table "public"."profile" (
    "id" text not null,
    "provider" text not null,
    "providerAccountId" text not null,
    "name" text not null,
    "image" text
);


alter table "public"."profile" enable row level security;

alter table "public"."log" alter column "gold" drop default;

alter table "public"."user" alter column "name" set not null;

CREATE UNIQUE INDEX profile_pkey ON public.profile USING btree (id);

alter table "public"."profile" add constraint "profile_pkey" PRIMARY KEY using index "profile_pkey";

alter table "public"."profile" add constraint "public_profile_provider_providerAccountId_fkey" FOREIGN KEY (provider, "providerAccountId") REFERENCES account(provider, "providerAccountId") ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."profile" validate constraint "public_profile_provider_providerAccountId_fkey";

grant delete on table "public"."profile" to "anon";

grant insert on table "public"."profile" to "anon";

grant references on table "public"."profile" to "anon";

grant select on table "public"."profile" to "anon";

grant trigger on table "public"."profile" to "anon";

grant truncate on table "public"."profile" to "anon";

grant update on table "public"."profile" to "anon";

grant delete on table "public"."profile" to "authenticated";

grant insert on table "public"."profile" to "authenticated";

grant references on table "public"."profile" to "authenticated";

grant select on table "public"."profile" to "authenticated";

grant trigger on table "public"."profile" to "authenticated";

grant truncate on table "public"."profile" to "authenticated";

grant update on table "public"."profile" to "authenticated";

grant delete on table "public"."profile" to "service_role";

grant insert on table "public"."profile" to "service_role";

grant references on table "public"."profile" to "service_role";

grant select on table "public"."profile" to "service_role";

grant trigger on table "public"."profile" to "service_role";

grant truncate on table "public"."profile" to "service_role";

grant update on table "public"."profile" to "service_role";


