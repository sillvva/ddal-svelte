create table "public"."authenticator" (
    "credentialID" text not null,
    "userId" text not null,
    "providerAccountId" text not null,
    "credentialPublicKey" text not null,
    "counter" integer not null,
    "credentialDeviceType" text not null,
    "credentialBackedUp" boolean not null,
    "transports" text,
    "name" text not null default ''::text
);


alter table "public"."authenticator" enable row level security;

CREATE UNIQUE INDEX "Authenticator_credentialID_key" ON public.authenticator USING btree ("credentialID");

CREATE UNIQUE INDEX "account_userId_providerAccountId_key" ON public.account USING btree ("userId", "providerAccountId");

CREATE UNIQUE INDEX authenticator_pkey ON public.authenticator USING btree ("credentialID", "userId");

CREATE UNIQUE INDEX "authenticator_userId_name_key" ON public.authenticator USING btree ("userId", name);

alter table "public"."authenticator" add constraint "authenticator_pkey" PRIMARY KEY using index "authenticator_pkey";

alter table "public"."account" add constraint "account_userId_providerAccountId_key" UNIQUE using index "account_userId_providerAccountId_key";

alter table "public"."authenticator" add constraint "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."authenticator" validate constraint "Authenticator_userId_fkey";

alter table "public"."authenticator" add constraint "authenticator_userId_name_key" UNIQUE using index "authenticator_userId_name_key";

alter table "public"."authenticator" add constraint "public_authenticator_userId_providerAccountId_fkey" FOREIGN KEY ("userId", "providerAccountId") REFERENCES account("userId", "providerAccountId") ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."authenticator" validate constraint "public_authenticator_userId_providerAccountId_fkey";

grant delete on table "public"."authenticator" to "anon";

grant insert on table "public"."authenticator" to "anon";

grant references on table "public"."authenticator" to "anon";

grant select on table "public"."authenticator" to "anon";

grant trigger on table "public"."authenticator" to "anon";

grant truncate on table "public"."authenticator" to "anon";

grant update on table "public"."authenticator" to "anon";

grant delete on table "public"."authenticator" to "authenticated";

grant insert on table "public"."authenticator" to "authenticated";

grant references on table "public"."authenticator" to "authenticated";

grant select on table "public"."authenticator" to "authenticated";

grant trigger on table "public"."authenticator" to "authenticated";

grant truncate on table "public"."authenticator" to "authenticated";

grant update on table "public"."authenticator" to "authenticated";

grant delete on table "public"."authenticator" to "service_role";

grant insert on table "public"."authenticator" to "service_role";

grant references on table "public"."authenticator" to "service_role";

grant select on table "public"."authenticator" to "service_role";

grant trigger on table "public"."authenticator" to "service_role";

grant truncate on table "public"."authenticator" to "service_role";

grant update on table "public"."authenticator" to "service_role";


