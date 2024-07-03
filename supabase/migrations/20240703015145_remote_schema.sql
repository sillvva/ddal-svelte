update "public"."log" set "description" = '' where "description" is null;

alter table "public"."log" alter column "description" set default ''::text;

alter table "public"."log" alter column "description" set not null;


