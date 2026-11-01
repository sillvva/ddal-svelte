-- Images pasted or dropped into a log's notes.
--
-- Uploads reuse image_upload with purpose 'note' and no character. Object keys are per account,
-- because one image can be referenced by several of that account's logs:
--   tmp/users/{user}/notes/{upload}.{webp|jpg}  until a log save promotes it (bucket lifecycle rule expires tmp/)
--   users/{user}/notes/{upload}.{webp|jpg}      after
--
-- log_image holds one row per image per log that references it. A log save deletes the rows for
-- images no longer in its notes and inserts rows for new ones. The statement trigger below queues a
-- permanent note object in pending_object_deletion as soon as its last row is deleted, in the same
-- statement as that delete. Rows removed by cascade (deleting a log, character, or account) go
-- through the same trigger. The app's purge step re-checks log_image under the account's advisory
-- lock before it deletes anything, and then removes the image_upload row.

alter table "public"."image_upload" drop constraint "image_upload_purpose_check";

alter table "public"."image_upload" add constraint "image_upload_purpose_check" check (
	("purpose" = 'character' and "character_id" is not null)
	or ("purpose" in ('avatar', 'note') and "character_id" is null)
);

create table "public"."log_image" (
	"log_id" uuid not null,
	"upload_id" uuid not null,
	"created_at" timestamp with time zone not null default now(),
	constraint "log_image_pkey" primary key ("log_id", "upload_id"),
	constraint "log_image_log_id_fkey" foreign key ("log_id") references "public"."log" ("id") on update cascade on delete cascade,
	constraint "log_image_upload_id_fkey" foreign key ("upload_id") references "public"."image_upload" ("id") on update cascade on delete cascade
);

create index "log_image_upload_idx" on "public"."log_image" ("upload_id");

alter table "public"."pending_object_deletion" drop constraint "pending_object_deletion_permanent_key";

alter table "public"."pending_object_deletion" add constraint "pending_object_deletion_permanent_key" check (
	"object_key" ~* '^users/[0-9a-f-]{36}/characters/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
	or "object_key" ~* '^users/[0-9a-f-]{36}/avatar/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
	or "object_key" ~* '^users/[0-9a-f-]{36}/notes/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
);

create function "public"."queue_orphaned_note_images"()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	insert into public.pending_object_deletion (object_key)
	select upload.object_key
	from public.image_upload upload
	where upload.id in (select distinct removed.upload_id from removed)
		and upload.purpose = 'note'
		and upload.object_key ~* '^users/[0-9a-f-]{36}/notes/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
		and not exists (select 1 from public.log_image remaining where remaining.upload_id = upload.id)
	on conflict (object_key) do nothing;
	return null;
end;
$$;

create trigger "log_image_queue_orphaned_note_images"
	after delete on "public"."log_image"
	referencing old table as removed
	for each statement
	execute function "public"."queue_orphaned_note_images"();
