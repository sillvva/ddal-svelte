create table "public"."verificationtoken" (
    "identifier" text not null,
    "token" text not null,
    "expires" timestamp without time zone not null
);


alter table "public"."verificationtoken" enable row level security;

CREATE UNIQUE INDEX verificationtoken_pkey ON public.verificationtoken USING btree (identifier, token);

alter table "public"."verificationtoken" add constraint "verificationtoken_pkey" PRIMARY KEY using index "verificationtoken_pkey";

grant delete on table "public"."verificationtoken" to "anon";

grant insert on table "public"."verificationtoken" to "anon";

grant references on table "public"."verificationtoken" to "anon";

grant select on table "public"."verificationtoken" to "anon";

grant trigger on table "public"."verificationtoken" to "anon";

grant truncate on table "public"."verificationtoken" to "anon";

grant update on table "public"."verificationtoken" to "anon";

grant delete on table "public"."verificationtoken" to "authenticated";

grant insert on table "public"."verificationtoken" to "authenticated";

grant references on table "public"."verificationtoken" to "authenticated";

grant select on table "public"."verificationtoken" to "authenticated";

grant trigger on table "public"."verificationtoken" to "authenticated";

grant truncate on table "public"."verificationtoken" to "authenticated";

grant update on table "public"."verificationtoken" to "authenticated";

grant delete on table "public"."verificationtoken" to "service_role";

grant insert on table "public"."verificationtoken" to "service_role";

grant references on table "public"."verificationtoken" to "service_role";

grant select on table "public"."verificationtoken" to "service_role";

grant trigger on table "public"."verificationtoken" to "service_role";

grant truncate on table "public"."verificationtoken" to "service_role";

grant update on table "public"."verificationtoken" to "service_role";


