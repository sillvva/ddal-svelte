-- Converts image_upload.purpose from text to the "imageUploadPurpose" enum.
--
-- image_upload_purpose_check is dropped before the type change and re-added after it. The constraint
-- was created with text comparisons, so Postgres stored it with explicit ::text casts. Those casts
-- make the enum comparison fail during ALTER COLUMN TYPE. Re-adding it with bare literals lets them
-- coerce to the enum. The rule itself is unchanged: it still ties purpose to character_id.
--
-- The text default must be dropped before the type change. Postgres cannot cast it automatically,
-- so it is set again afterward. Any existing value outside the enum makes the USING cast fail, and
-- the whole migration rolls back.

create type "public"."imageUploadPurpose" as enum ('character', 'avatar', 'note');

alter table "public"."image_upload" drop constraint "image_upload_purpose_check";

alter table "public"."image_upload" alter column "purpose" drop default;

alter table "public"."image_upload"
	alter column "purpose" type "public"."imageUploadPurpose"
	using "purpose"::"public"."imageUploadPurpose";

alter table "public"."image_upload" alter column "purpose" set default 'character';

alter table "public"."image_upload" add constraint "image_upload_purpose_check" check (
	("purpose" = 'character' and "character_id" is not null)
	or ("purpose" in ('avatar', 'note') and "character_id" is null)
);
