
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";

CREATE SCHEMA IF NOT EXISTS "public";

ALTER SCHEMA "public" OWNER TO "pg_database_owner";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."delete_expired_sessions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$BEGIN
  DELETE FROM "session" WHERE expires < NOW();
  RETURN NEW;
END;$$;

ALTER FUNCTION "public"."delete_expired_sessions"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."account" (
    "userId" character varying NOT NULL,
    "type" character varying NOT NULL,
    "provider" character varying NOT NULL,
    "providerAccountId" character varying NOT NULL,
    "refresh_token" character varying,
    "access_token" character varying NOT NULL,
    "expires_at" integer NOT NULL,
    "token_type" character varying NOT NULL,
    "scope" character varying NOT NULL,
    "id_token" character varying,
    "session_state" character varying
);

ALTER TABLE "public"."account" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."character" (
    "id" character varying NOT NULL,
    "name" character varying NOT NULL,
    "race" character varying,
    "class" character varying,
    "campaign" character varying,
    "image_url" character varying,
    "character_sheet_url" character varying,
    "userId" character varying NOT NULL,
    "created_at" timestamp without time zone NOT NULL
);

ALTER TABLE "public"."character" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."dungeonmaster" (
    "name" character varying NOT NULL,
    "DCI" character varying,
    "uid" character varying,
    "owner" character varying NOT NULL,
    "id" character varying NOT NULL
);

ALTER TABLE "public"."dungeonmaster" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."log" (
    "id" character varying NOT NULL,
    "date" timestamp without time zone DEFAULT "now"() NOT NULL,
    "name" character varying NOT NULL,
    "description" character varying,
    "type" character varying NOT NULL,
    "dungeonMasterId" character varying,
    "is_dm_log" boolean NOT NULL,
    "experience" integer DEFAULT 0 NOT NULL,
    "acp" smallint DEFAULT '0'::smallint NOT NULL,
    "tcp" smallint DEFAULT '0'::smallint NOT NULL,
    "level" smallint DEFAULT '0'::smallint NOT NULL,
    "gold" real DEFAULT '0'::real NOT NULL,
    "dtd" smallint DEFAULT '0'::smallint NOT NULL,
    "applied_date" timestamp without time zone,
    "characterId" character varying,
    "created_at" timestamp without time zone NOT NULL
);

ALTER TABLE "public"."log" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."magicitem" (
    "id" character varying NOT NULL,
    "name" character varying NOT NULL,
    "description" "text",
    "logGainedId" character varying NOT NULL,
    "logLostId" character varying
);

ALTER TABLE "public"."magicitem" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."session" (
    "sessionToken" character varying NOT NULL,
    "userId" character varying NOT NULL,
    "expires" timestamp without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."session" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."storyaward" (
    "id" character varying NOT NULL,
    "name" character varying NOT NULL,
    "description" "text",
    "logGainedId" character varying NOT NULL,
    "logLostId" character varying
);

ALTER TABLE "public"."storyaward" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."user" (
    "id" character varying NOT NULL,
    "name" character varying NOT NULL,
    "email" character varying,
    "emailVerified" timestamp without time zone,
    "image" "text"
);

ALTER TABLE "public"."user" OWNER TO "postgres";

ALTER TABLE ONLY "public"."account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("provider", "providerAccountId");

ALTER TABLE ONLY "public"."character"
    ADD CONSTRAINT "Character_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."dungeonmaster"
    ADD CONSTRAINT "DungeonMaster_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."log"
    ADD CONSTRAINT "Log_pkey1" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."magicitem"
    ADD CONSTRAINT "MagicItem_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionToken");

ALTER TABLE ONLY "public"."storyaward"
    ADD CONSTRAINT "StoryAward_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

CREATE INDEX "Account_userId_idx" ON "public"."account" USING "btree" ("userId");

CREATE INDEX "Character_userId_idx" ON "public"."character" USING "btree" ("userId");

CREATE INDEX "DungeonMaster_owner_idx" ON "public"."dungeonmaster" USING "btree" ("owner");

CREATE INDEX "DungeonMaster_uid_idx" ON "public"."dungeonmaster" USING "btree" ("uid");

CREATE INDEX "Log_characterId_idx" ON "public"."log" USING "btree" ("characterId");

CREATE INDEX "Log_dungeonMasterId_idx" ON "public"."log" USING "btree" ("dungeonMasterId");

CREATE INDEX "MagicItem_logGainedId_idx" ON "public"."magicitem" USING "btree" ("logGainedId");

CREATE INDEX "MagicItem_logLostId_idx" ON "public"."magicitem" USING "btree" ("logLostId");

CREATE INDEX "Session_userId_idx" ON "public"."session" USING "btree" ("userId");

CREATE INDEX "StoryAward_logGainedId_idx" ON "public"."storyaward" USING "btree" ("logGainedId");

CREATE INDEX "StoryAward_logLostId_idx" ON "public"."storyaward" USING "btree" ("logLostId");

CREATE OR REPLACE TRIGGER "delete_expired_sessions_trigger" AFTER INSERT OR UPDATE ON "public"."session" FOR EACH STATEMENT EXECUTE FUNCTION "public"."delete_expired_sessions"();

ALTER TABLE ONLY "public"."account"
    ADD CONSTRAINT "public_Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."character"
    ADD CONSTRAINT "public_Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."dungeonmaster"
    ADD CONSTRAINT "public_DungeonMaster_owner_fkey" FOREIGN KEY ("owner") REFERENCES "public"."user"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."log"
    ADD CONSTRAINT "public_Log_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "public"."character"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."log"
    ADD CONSTRAINT "public_Log_dungeonMasterId_fkey" FOREIGN KEY ("dungeonMasterId") REFERENCES "public"."dungeonmaster"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY "public"."magicitem"
    ADD CONSTRAINT "public_MagicItem_logGainedId_fkey" FOREIGN KEY ("logGainedId") REFERENCES "public"."log"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."magicitem"
    ADD CONSTRAINT "public_MagicItem_logLostId_fkey" FOREIGN KEY ("logLostId") REFERENCES "public"."log"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY "public"."session"
    ADD CONSTRAINT "public_Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."storyaward"
    ADD CONSTRAINT "public_StoryAward_logGainedId_fkey" FOREIGN KEY ("logGainedId") REFERENCES "public"."log"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."storyaward"
    ADD CONSTRAINT "public_StoryAward_logLostId_fkey" FOREIGN KEY ("logLostId") REFERENCES "public"."log"("id") ON UPDATE CASCADE ON DELETE SET NULL;

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."account" TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."character" TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."dungeonmaster" TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."log" TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."session" TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."user" TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."character" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."log" FOR SELECT USING (true);

ALTER TABLE "public"."account" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."character" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."dungeonmaster" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."magicitem" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."session" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."storyaward" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."delete_expired_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_expired_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_expired_sessions"() TO "service_role";

GRANT ALL ON TABLE "public"."account" TO "anon";
GRANT ALL ON TABLE "public"."account" TO "authenticated";
GRANT ALL ON TABLE "public"."account" TO "service_role";

GRANT ALL ON TABLE "public"."character" TO "anon";
GRANT ALL ON TABLE "public"."character" TO "authenticated";
GRANT ALL ON TABLE "public"."character" TO "service_role";

GRANT ALL ON TABLE "public"."dungeonmaster" TO "anon";
GRANT ALL ON TABLE "public"."dungeonmaster" TO "authenticated";
GRANT ALL ON TABLE "public"."dungeonmaster" TO "service_role";

GRANT ALL ON TABLE "public"."log" TO "anon";
GRANT ALL ON TABLE "public"."log" TO "authenticated";
GRANT ALL ON TABLE "public"."log" TO "service_role";

GRANT ALL ON TABLE "public"."magicitem" TO "anon";
GRANT ALL ON TABLE "public"."magicitem" TO "authenticated";
GRANT ALL ON TABLE "public"."magicitem" TO "service_role";

GRANT ALL ON TABLE "public"."session" TO "anon";
GRANT ALL ON TABLE "public"."session" TO "authenticated";
GRANT ALL ON TABLE "public"."session" TO "service_role";

GRANT ALL ON TABLE "public"."storyaward" TO "anon";
GRANT ALL ON TABLE "public"."storyaward" TO "authenticated";
GRANT ALL ON TABLE "public"."storyaward" TO "service_role";

GRANT ALL ON TABLE "public"."user" TO "anon";
GRANT ALL ON TABLE "public"."user" TO "authenticated";
GRANT ALL ON TABLE "public"."user" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";

RESET ALL;
