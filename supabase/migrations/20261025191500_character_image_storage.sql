alter table "public"."character" add column "image_bytes" integer not null default 0;

alter table "public"."character" add constraint "character_image_bytes_nonnegative" check ("image_bytes" >= 0);

create table "public"."character_image_upload" (
	"id" uuid primary key,
	"user_id" uuid not null,
	"character_id" uuid not null,
	"object_key" text not null,
	"bytes" integer not null,
	"content_type" text not null,
	"created_at" timestamp with time zone not null default now(),
	"completed_at" timestamp with time zone,
	"attached" boolean not null default false,
	"discarded_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	constraint "character_image_upload_bytes_positive" check ("bytes" > 0),
	constraint "character_image_upload_user_id_fkey" foreign key ("user_id") references "public"."user" ("id") on update cascade on delete cascade
);

create unique index "character_image_upload_object_key_unique" on "public"."character_image_upload" ("object_key");

create index "character_image_upload_user_created_idx" on "public"."character_image_upload" ("user_id", "created_at");

create index "character_image_upload_character_idx" on "public"."character_image_upload" ("character_id");
