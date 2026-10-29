-- Queue staged tmp/ image keys when an account (or character) is deleted.
--
-- MAINTENANCE WINDOW: this migration changes a CHECK constraint on
-- public.pending_object_deletion. Apply it before deploying the app version that
-- inserts tmp/ keys. `supabase db push` runs the file in one transaction.
-- Adding the constraint validates existing rows. Those rows are permanent keys and
-- still match, so this does not rewrite table data. It takes a short lock on
-- pending_object_deletion while the constraint is swapped.
--
-- Before this change the table only accepted permanent portrait and avatar keys.
-- Unsaved uploads under tmp/ were left in the bucket until the lifecycle rule
-- (about a day) even though deleting the account removed their image_upload rows.
-- Account deletion now records those keys here so storage purge can retry them
-- after the user row is gone.

alter table "public"."pending_object_deletion" drop constraint "pending_object_deletion_permanent_key";

alter table "public"."pending_object_deletion" add constraint "pending_object_deletion_image_key" check (
	"object_key" ~* '^users/[0-9a-f-]{36}/characters/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
	or "object_key" ~* '^users/[0-9a-f-]{36}/avatar/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
	or "object_key" ~* '^tmp/users/[0-9a-f-]{36}/characters/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
	or "object_key" ~* '^tmp/users/[0-9a-f-]{36}/avatar/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
);
