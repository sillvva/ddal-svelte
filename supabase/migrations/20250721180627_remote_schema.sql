BEGIN;

-- 1. Drop Foreign Key Constraints (public schema only, all names in double quotes)
ALTER TABLE "public"."account"      DROP CONSTRAINT IF EXISTS "public_account_userId_fkey";
ALTER TABLE "public"."session"      DROP CONSTRAINT IF EXISTS "public_session_userId_fkey";
ALTER TABLE "public"."character"    DROP CONSTRAINT IF EXISTS "public_Character_userId_fkey";
ALTER TABLE "public"."dungeonmaster" DROP CONSTRAINT IF EXISTS "dungeonmaster_user_id_fkey";
ALTER TABLE "public"."passkey"      DROP CONSTRAINT IF EXISTS "public_passkey_userId_fkey";
ALTER TABLE "public"."log"          DROP CONSTRAINT IF EXISTS "public_log_characterId_fkey";
ALTER TABLE "public"."log"          DROP CONSTRAINT IF EXISTS "public_log_dungeonMasterId_fkey";
ALTER TABLE "public"."magicitem"    DROP CONSTRAINT IF EXISTS "public_MagicItem_logGainedId_fkey";
ALTER TABLE "public"."magicitem"    DROP CONSTRAINT IF EXISTS "public_MagicItem_logLostId_fkey";
ALTER TABLE "public"."storyaward"   DROP CONSTRAINT IF EXISTS "public_StoryAward_logGainedId_fkey";
ALTER TABLE "public"."storyaward"   DROP CONSTRAINT IF EXISTS "public_StoryAward_logLostId_fkey";

-- Drop defaults for id columns
ALTER TABLE "public"."user" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "public"."account" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "public"."session" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "public"."passkey" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "public"."character" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "public"."dungeonmaster" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "public"."log" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "public"."magicitem" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "public"."storyaward" ALTER COLUMN "id" DROP DEFAULT;

-- 2. Alter Column Types

ALTER TABLE "public"."user" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

ALTER TABLE "public"."account" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
ALTER TABLE "public"."account" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;

ALTER TABLE "public"."session" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
ALTER TABLE "public"."session" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;

ALTER TABLE "public"."passkey" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
ALTER TABLE "public"."passkey" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;

ALTER TABLE "public"."character" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
ALTER TABLE "public"."character" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;

ALTER TABLE "public"."dungeonmaster" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
ALTER TABLE "public"."dungeonmaster" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;

ALTER TABLE "public"."log" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
ALTER TABLE "public"."log" ALTER COLUMN "characterId" TYPE uuid USING "characterId"::uuid;
ALTER TABLE "public"."log" ALTER COLUMN "dungeonMasterId" TYPE uuid USING "dungeonMasterId"::uuid;

ALTER TABLE "public"."magicitem" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
ALTER TABLE "public"."magicitem" ALTER COLUMN "logGainedId" TYPE uuid USING "logGainedId"::uuid;
ALTER TABLE "public"."magicitem" ALTER COLUMN "logLostId" TYPE uuid USING "logLostId"::uuid;

ALTER TABLE "public"."storyaward" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
ALTER TABLE "public"."storyaward" ALTER COLUMN "logGainedId" TYPE uuid USING "logGainedId"::uuid;
ALTER TABLE "public"."storyaward" ALTER COLUMN "logLostId" TYPE uuid USING "logLostId"::uuid;

-- 3. Re-add Foreign Key Constraints (all names in double quotes)

ALTER TABLE "public"."account"
  ADD CONSTRAINT "public_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."session"
  ADD CONSTRAINT "public_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."character"
  ADD CONSTRAINT "public_Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."dungeonmaster"
  ADD CONSTRAINT "dungeonmaster_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."passkey"
  ADD CONSTRAINT "public_passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."log"
  ADD CONSTRAINT "public_log_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."character"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."log"
  ADD CONSTRAINT "public_log_dungeonMasterId_fkey" FOREIGN KEY ("dungeonMasterId") REFERENCES "public"."dungeonmaster"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."magicitem"
  ADD CONSTRAINT "public_MagicItem_logGainedId_fkey" FOREIGN KEY ("logGainedId") REFERENCES "public"."log"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."magicitem"
  ADD CONSTRAINT "public_MagicItem_logLostId_fkey" FOREIGN KEY ("logLostId") REFERENCES "public"."log"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "public"."storyaward"
  ADD CONSTRAINT "public_StoryAward_logGainedId_fkey" FOREIGN KEY ("logGainedId") REFERENCES "public"."log"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."storyaward"
  ADD CONSTRAINT "public_StoryAward_logLostId_fkey" FOREIGN KEY ("logLostId") REFERENCES "public"."log"("id") ON UPDATE CASCADE ON DELETE SET NULL;

COMMIT;