revoke delete on table "public"."authenticator" from "anon";

revoke insert on table "public"."authenticator" from "anon";

revoke references on table "public"."authenticator" from "anon";

revoke select on table "public"."authenticator" from "anon";

revoke trigger on table "public"."authenticator" from "anon";

revoke truncate on table "public"."authenticator" from "anon";

revoke update on table "public"."authenticator" from "anon";

revoke delete on table "public"."authenticator" from "authenticated";

revoke insert on table "public"."authenticator" from "authenticated";

revoke references on table "public"."authenticator" from "authenticated";

revoke select on table "public"."authenticator" from "authenticated";

revoke trigger on table "public"."authenticator" from "authenticated";

revoke truncate on table "public"."authenticator" from "authenticated";

revoke update on table "public"."authenticator" from "authenticated";

revoke delete on table "public"."authenticator" from "service_role";

revoke insert on table "public"."authenticator" from "service_role";

revoke references on table "public"."authenticator" from "service_role";

revoke select on table "public"."authenticator" from "service_role";

revoke trigger on table "public"."authenticator" from "service_role";

revoke truncate on table "public"."authenticator" from "service_role";

revoke update on table "public"."authenticator" from "service_role";

alter table "public"."authenticator" drop constraint "Authenticator_userId_fkey";

alter table "public"."authenticator" drop constraint "authenticator_userId_name_key";

alter table "public"."authenticator" drop constraint "public_authenticator_userId_providerAccountId_fkey";

alter table "public"."account" drop constraint "Account_pkey";

alter table "public"."authenticator" drop constraint "authenticator_pkey";

alter table "public"."session" drop constraint "Session_pkey";

drop index if exists "public"."Account_pkey";

drop index if exists "public"."Authenticator_credentialID_key";

drop index if exists "public"."Session_pkey";

drop index if exists "public"."authenticator_pkey";

drop index if exists "public"."authenticator_userId_name_key";

drop table "public"."authenticator";

create table "public"."passkey" (
    "id" text not null default (gen_random_uuid())::text,
    "name" text,
    "publicKey" text not null,
    "userId" text not null,
    "credentialID" text not null,
    "counter" bigint not null default 0,
    "deviceType" text not null,
    "backedUp" boolean not null default false,
    "transports" text not null,
    "createdAt" timestamp with time zone not null default now(),
    "aaguid" text
);


alter table "public"."passkey" enable row level security;

create table "public"."verification" (
    "id" text not null,
    "identifier" text not null,
    "value" text not null,
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."verification" enable row level security;

alter table "public"."account" drop column "last_login";

alter table "public"."account" drop column "session_state";

alter table "public"."account" drop column "token_type";

alter table "public"."account" drop column "type";

alter table "public"."account" add column "created_at" timestamp with time zone not null default now();

alter table "public"."account" add column "id" text not null default (gen_random_uuid())::text;

alter table "public"."account" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."account" alter column "expires_at" set data type timestamp with time zone using "expires_at"::timestamp with time zone;

alter table "public"."session" add column "id" text not null default (gen_random_uuid())::text;

alter table "public"."session" add column "ip_address" text;

alter table "public"."session" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."session" add column "user_agent" text;

alter table "public"."user" add column "created_at" timestamp with time zone not null default now();

alter table "public"."user" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."user" alter column "emailVerified" set default false;

alter table "public"."user" alter column "emailVerified" set not null;

alter table "public"."user" alter column "emailVerified" set data type boolean using "emailVerified"::boolean;

CREATE UNIQUE INDEX account_pkey ON public.account USING btree (id);

CREATE UNIQUE INDEX passkey_pkey ON public.passkey USING btree (id);

CREATE UNIQUE INDEX session_pkey ON public.session USING btree (id);

CREATE UNIQUE INDEX verification_pkey ON public.verification USING btree (id);

alter table "public"."account" add constraint "account_pkey" PRIMARY KEY using index "account_pkey";

alter table "public"."passkey" add constraint "passkey_pkey" PRIMARY KEY using index "passkey_pkey";

alter table "public"."session" add constraint "session_pkey" PRIMARY KEY using index "session_pkey";

alter table "public"."verification" add constraint "verification_pkey" PRIMARY KEY using index "verification_pkey";

alter table "public"."passkey" add constraint "public_passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."passkey" validate constraint "public_passkey_userId_fkey";

grant delete on table "public"."passkey" to "anon";

grant insert on table "public"."passkey" to "anon";

grant references on table "public"."passkey" to "anon";

grant select on table "public"."passkey" to "anon";

grant trigger on table "public"."passkey" to "anon";

grant truncate on table "public"."passkey" to "anon";

grant update on table "public"."passkey" to "anon";

grant delete on table "public"."passkey" to "authenticated";

grant insert on table "public"."passkey" to "authenticated";

grant references on table "public"."passkey" to "authenticated";

grant select on table "public"."passkey" to "authenticated";

grant trigger on table "public"."passkey" to "authenticated";

grant truncate on table "public"."passkey" to "authenticated";

grant update on table "public"."passkey" to "authenticated";

grant delete on table "public"."passkey" to "service_role";

grant insert on table "public"."passkey" to "service_role";

grant references on table "public"."passkey" to "service_role";

grant select on table "public"."passkey" to "service_role";

grant trigger on table "public"."passkey" to "service_role";

grant truncate on table "public"."passkey" to "service_role";

grant update on table "public"."passkey" to "service_role";

grant delete on table "public"."verification" to "anon";

grant insert on table "public"."verification" to "anon";

grant references on table "public"."verification" to "anon";

grant select on table "public"."verification" to "anon";

grant trigger on table "public"."verification" to "anon";

grant truncate on table "public"."verification" to "anon";

grant update on table "public"."verification" to "anon";

grant delete on table "public"."verification" to "authenticated";

grant insert on table "public"."verification" to "authenticated";

grant references on table "public"."verification" to "authenticated";

grant select on table "public"."verification" to "authenticated";

grant trigger on table "public"."verification" to "authenticated";

grant truncate on table "public"."verification" to "authenticated";

grant update on table "public"."verification" to "authenticated";

grant delete on table "public"."verification" to "service_role";

grant insert on table "public"."verification" to "service_role";

grant references on table "public"."verification" to "service_role";

grant select on table "public"."verification" to "service_role";

grant trigger on table "public"."verification" to "service_role";

grant truncate on table "public"."verification" to "service_role";

grant update on table "public"."verification" to "service_role";


