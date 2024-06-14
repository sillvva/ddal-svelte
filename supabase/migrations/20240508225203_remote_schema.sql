alter table "public"."account" add constraint "public_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."account" validate constraint "public_account_userId_fkey";

alter table "public"."session" add constraint "public_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."session" validate constraint "public_session_userId_fkey";


