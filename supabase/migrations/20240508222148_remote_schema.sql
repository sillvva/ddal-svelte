alter table "public"."dungeonmaster" add constraint "public_dungeonmaster_uid_fkey" FOREIGN KEY (uid) REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."dungeonmaster" validate constraint "public_dungeonmaster_uid_fkey";


