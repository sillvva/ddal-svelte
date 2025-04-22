BEGIN;

-- Rename the column
ALTER TABLE dungeonmaster RENAME COLUMN owner TO user_id;

-- Rename the foreign key constraint
ALTER TABLE dungeonmaster RENAME CONSTRAINT "public_DungeonMaster_owner_fkey" TO "dungeonmaster_user_id_fkey";

-- Rename the index
ALTER INDEX "DungeonMaster_owner_idx" RENAME TO "dungeonmaster_user_id_idx";

-- For uid column, since you are dropping it, you must drop its FK and index first
ALTER TABLE dungeonmaster DROP CONSTRAINT "public_dungeonmaster_uid_fkey";
DROP INDEX IF EXISTS "DungeonMaster_uid_partial_idx";

-- Add new isUser column with default false and not null
ALTER TABLE dungeonmaster ADD COLUMN is_user boolean NOT NULL DEFAULT false;

-- Update isUser to true where previous uid matched owner (now userId)
UPDATE dungeonmaster
SET is_user = true
WHERE uid IS NOT NULL AND uid = user_id;

-- Drop the uid column
ALTER TABLE dungeonmaster DROP COLUMN uid;

-- Data integrity checks
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dungeonmaster' AND column_name = 'uid'
    ) THEN
        RAISE EXCEPTION 'uid column still exists';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM dungeonmaster WHERE user_id IS NULL
    ) THEN
        RAISE EXCEPTION 'is_user column contains NULL values';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM dungeonmaster WHERE is_user IS NULL
    ) THEN
        RAISE EXCEPTION 'is_user column contains NULL values';
    END IF;
END $$;

COMMIT;
