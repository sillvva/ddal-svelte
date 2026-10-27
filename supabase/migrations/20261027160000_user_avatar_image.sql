-- Profile pictures for accounts that do not sign in with OAuth.
-- Staged uploads still live under `tmp/` and expire via the existing bucket lifecycle rule.
-- Each account has at most one avatar, capped when the upload is signed, so avatar bytes
-- are not added to the portrait quota and are not stored on `user`.

alter table "public"."character_image_upload" alter column "character_id" drop not null;

alter table "public"."character_image_upload" add column "purpose" text not null default 'character';

alter table "public"."character_image_upload" add constraint "character_image_upload_purpose_check" check (
	("purpose" = 'character' and "character_id" is not null)
	or ("purpose" = 'avatar' and "character_id" is null)
);

alter table "public"."pending_object_deletion" drop constraint "pending_object_deletion_permanent_key";

alter table "public"."pending_object_deletion" add constraint "pending_object_deletion_permanent_key" check (
	"object_key" ~* '^users/[0-9a-f-]{36}/characters/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
	or "object_key" ~* '^users/[0-9a-f-]{36}/avatar/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
);
