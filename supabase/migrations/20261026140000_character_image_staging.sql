-- Unsaved portrait uploads now live under the R2 prefix `tmp/` and are removed by a bucket
-- lifecycle rule (prefix `tmp/`, expire after 1 day). That rule is not created here.
-- This migration drops the bookkeeping that tracked those unsaved objects, and records
-- permanent-object deletes so they can be retried after the owning user row is gone.

alter table "public"."character_image_upload"
	drop column if exists "attached",
	drop column if exists "discarded_at",
	drop column if exists "removed_at";

create table "public"."pending_object_deletion" (
	"id" uuid primary key default gen_random_uuid(),
	"object_key" text not null,
	"created_at" timestamp with time zone not null default now(),
	"attempts" integer not null default 0,
	constraint "pending_object_deletion_object_key_unique" unique ("object_key"),
	constraint "pending_object_deletion_attempts_nonnegative" check ("attempts" >= 0),
	constraint "pending_object_deletion_permanent_key" check (
		"object_key" ~* '^users/[0-9a-f-]{36}/characters/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
	)
);

create index "pending_object_deletion_created_idx" on "public"."pending_object_deletion" ("created_at");
