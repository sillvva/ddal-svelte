alter table "public"."account" drop constraint "public_Account_userId_fkey";

alter table "public"."session" drop constraint "public_Session_userId_fkey";

drop index if exists "public"."DungeonMaster_uid_idx";

drop index if exists "public"."Log_characterId_idx";

CREATE INDEX "DungeonMaster_uid_partial_idx" ON public.dungeonmaster USING btree (uid) WHERE (uid IS NOT NULL);

CREATE INDEX "Log_characterId_partial_idx" ON public.log USING btree ("characterId") WHERE ("characterId" IS NOT NULL);


