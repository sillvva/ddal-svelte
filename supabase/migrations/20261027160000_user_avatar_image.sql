-- Profile pictures for accounts that do not sign in with OAuth, and a rename of the
-- upload table so portraits and avatars share it.
--
-- The table already exists in production as character_image_upload. This renames it
-- in place (no copy, no data loss) and then adds the avatar columns. Apply the file
-- in one transaction so a failure leaves the old name intact. `supabase db push`
-- already wraps each migration file. For a manual psql session during maintenance:
--   BEGIN;
--   \i supabase/migrations/20261027160000_user_avatar_image.sql
--   COMMIT;
--
-- ALTER TABLE RENAME does not rename indexes, constraints, sequences, triggers, or
-- policies. Those are renamed below. The id column is a uuid with no sequence.
-- Staged uploads still live under `tmp/` and expire via the existing bucket lifecycle rule.
-- Each account has at most one avatar, capped when the upload is signed, so avatar bytes
-- are not added to the portrait quota and are not stored on `user`.

alter table "public"."character_image_upload" rename to "image_upload";

alter table "public"."image_upload" rename constraint "character_image_upload_pkey" to "image_upload_pkey";
alter table "public"."image_upload" rename constraint "character_image_upload_bytes_positive" to "image_upload_bytes_positive";
alter table "public"."image_upload" rename constraint "character_image_upload_user_id_fkey" to "image_upload_user_id_fkey";

alter index "public"."character_image_upload_object_key_unique" rename to "image_upload_object_key_unique";
alter index "public"."character_image_upload_user_created_idx" rename to "image_upload_user_created_idx";
alter index "public"."character_image_upload_character_idx" rename to "image_upload_character_idx";

-- Catch anything created outside these migrations (a sequence, trigger, policy, or extra index)
-- whose name still contains the old table name.
do $$
declare
	rec record;
	new_name text;
begin
	for rec in
		select n.nspname, c.relname, c.relkind
		from pg_class c
		join pg_namespace n on n.oid = c.relnamespace
		where c.relname ilike '%character_image_upload%'
			and n.nspname not in ('pg_catalog', 'information_schema')
	loop
		new_name := replace(rec.relname, 'character_image_upload', 'image_upload');
		if rec.relkind = 'S' then
			execute format('alter sequence %I.%I rename to %I', rec.nspname, rec.relname, new_name);
		elsif rec.relkind = 'i' then
			execute format('alter index %I.%I rename to %I', rec.nspname, rec.relname, new_name);
		elsif rec.relkind in ('r', 'p') then
			execute format('alter table %I.%I rename to %I', rec.nspname, rec.relname, new_name);
		else
			raise exception 'Cannot rename %.% (relkind %)', rec.nspname, rec.relname, rec.relkind;
		end if;
	end loop;

	for rec in
		select con.conname, con.conrelid::regclass as table_name
		from pg_constraint con
		where con.conname ilike '%character_image_upload%'
	loop
		new_name := replace(rec.conname, 'character_image_upload', 'image_upload');
		execute format('alter table %s rename constraint %I to %I', rec.table_name, rec.conname, new_name);
	end loop;

	for rec in
		select tg.tgname, tg.tgrelid::regclass as table_name
		from pg_trigger tg
		where not tg.tgisinternal
			and tg.tgname ilike '%character_image_upload%'
	loop
		new_name := replace(rec.tgname, 'character_image_upload', 'image_upload');
		execute format('alter trigger %I on %s rename to %I', rec.tgname, rec.table_name, new_name);
	end loop;

	for rec in
		select pol.polname, pol.polrelid::regclass as table_name
		from pg_policy pol
		where pol.polname ilike '%character_image_upload%'
	loop
		new_name := replace(rec.polname, 'character_image_upload', 'image_upload');
		execute format('alter policy %I on %s rename to %I', rec.polname, rec.table_name, new_name);
	end loop;
end $$;

alter table "public"."image_upload" alter column "character_id" drop not null;

alter table "public"."image_upload" add column "purpose" text not null default 'character';

alter table "public"."image_upload" add constraint "image_upload_purpose_check" check (
	("purpose" = 'character' and "character_id" is not null)
	or ("purpose" = 'avatar' and "character_id" is null)
);

alter table "public"."pending_object_deletion" drop constraint "pending_object_deletion_permanent_key";

alter table "public"."pending_object_deletion" add constraint "pending_object_deletion_permanent_key" check (
	"object_key" ~* '^users/[0-9a-f-]{36}/characters/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
	or "object_key" ~* '^users/[0-9a-f-]{36}/avatar/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg)$'
);

do $$
declare
	leftover text;
begin
	select string_agg(kind || ' ' || obj_name, ', ')
	into leftover
	from (
		select 'relation' as kind, n.nspname || '.' || c.relname as obj_name
		from pg_class c
		join pg_namespace n on n.oid = c.relnamespace
		where c.relname ilike '%character_image_upload%'
			and n.nspname not in ('pg_catalog', 'information_schema')
		union all
		select 'constraint', conname
		from pg_constraint
		where conname ilike '%character_image_upload%'
		union all
		select 'trigger', tgname
		from pg_trigger
		where not tgisinternal
			and tgname ilike '%character_image_upload%'
		union all
		select 'policy', polname
		from pg_policy
		where polname ilike '%character_image_upload%'
		union all
		select 'function', n.nspname || '.' || p.proname
		from pg_proc p
		join pg_namespace n on n.oid = p.pronamespace
		where p.proname ilike '%character_image_upload%'
			and n.nspname not in ('pg_catalog', 'information_schema')
	) found;

	if leftover is not null then
		raise exception 'Names still contain character_image_upload: %', leftover;
	end if;
end $$;
