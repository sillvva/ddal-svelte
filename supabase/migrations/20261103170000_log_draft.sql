-- Log drafts a DM (or a player) can share by link.
--
-- `data` is the log fields that are not tied to one character: title, optional date, DM name and
-- DCI, advancement, gold, downtime, gained items, and notes. It does not store a log id, a
-- character, dropped items, or its own image rows. Note images already saved on a log may stay
-- in the notes as links; new uploads are refused because a draft expires.
--
-- The share link is `/draft/<id>`. Editing keeps the same id and sets `updated_at`, which
-- restarts the 14-day lifetime. The app deletes rows once `updated_at` is older than 14 days.

create table "public"."log_draft" (
	"id" uuid not null,
	"user_id" uuid not null,
	"data" jsonb not null,
	"created_at" timestamp with time zone not null default now(),
	"updated_at" timestamp with time zone not null default now(),
	constraint "log_draft_pkey" primary key ("id"),
	constraint "log_draft_user_id_fkey" foreign key ("user_id") references "public"."user" ("id") on update cascade on delete cascade
);

create index "log_draft_user_id_idx" on "public"."log_draft" ("user_id");
create index "log_draft_updated_at_idx" on "public"."log_draft" ("updated_at");
