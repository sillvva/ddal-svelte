import postgres from "postgres";
import { v7 } from "uuid";

export async function withSql<T>(fn: (sql: postgres.Sql) => Promise<T>) {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is not set. REMOTE_DB_URL is never used.");
	const sql = postgres(databaseUrl, { prepare: false, max: 1 });
	try {
		return await fn(sql);
	} finally {
		await sql.end();
	}
}

export interface CharacterRow {
	id: string;
	name: string;
	userId: string;
}

export interface LogRow {
	id: string;
	name: string;
	characterId: string | null;
	dungeonMasterId: string;
	isDmLog: boolean;
	level: number;
	date: Date;
}

export interface DmRow {
	id: string;
	name: string;
	DCI: string;
	userId: string;
	isUser: boolean;
}

export interface ItemRow {
	id: string;
	name: string;
	logGainedId: string;
	logLostId: string | null;
}

export async function characterRow(id: string) {
	const rows = await withSql((sql) => sql<CharacterRow[]>`select id, name, "userId" from character where id = ${id}`);
	return rows[0] ?? null;
}

export async function logRow(id: string) {
	const rows = await withSql(
		(sql) => sql<LogRow[]>`
			select id, name, "characterId", "dungeonMasterId", is_dm_log as "isDmLog", level, date
			from log
			where id = ${id}
		`
	);
	return rows[0] ?? null;
}

export async function logIdsForCharacter(characterId: string) {
	const rows = await withSql((sql) => sql<{ id: string }[]>`select id from log where "characterId" = ${characterId} order by id`);
	return rows.map((row) => row.id);
}

export async function dmRow(id: string) {
	const rows = await withSql(
		(sql) => sql<DmRow[]>`
			select id, name, "DCI", user_id as "userId", is_user as "isUser"
			from dungeonmaster
			where id = ${id}
		`
	);
	return rows[0] ?? null;
}

export async function magicItemsGainedIn(logId: string) {
	return withSql(
		(sql) => sql<ItemRow[]>`
			select id, name, "logGainedId", "logLostId"
			from magicitem
			where "logGainedId" = ${logId}
			order by name
		`
	);
}

export async function magicItemRow(id: string) {
	const rows = await withSql(
		(sql) => sql<ItemRow[]>`select id, name, "logGainedId", "logLostId" from magicitem where id = ${id}`
	);
	return rows[0] ?? null;
}

export async function userDmId(userId: string) {
	const rows = await withSql(
		(sql) => sql<{ id: string }[]>`select id from dungeonmaster where user_id = ${userId} and is_user = true`
	);
	const id = rows[0]?.id;
	if (!id) throw new Error(`User ${userId} has no user DM`);
	return id;
}

export async function logDescription(id: string) {
	const rows = await withSql((sql) => sql<{ description: string }[]>`select description from log where id = ${id}`);
	return rows[0]?.description ?? null;
}

/** Object keys of the note images `log_image` records for a log. */
export async function logImageKeys(logId: string) {
	const rows = await withSql(
		(sql) => sql<{ objectKey: string }[]>`
			select upload.object_key as "objectKey"
			from log_image
			join image_upload upload on upload.id = log_image.upload_id
			where log_image.log_id = ${logId}
			order by upload.object_key
		`
	);
	return rows.map((row) => row.objectKey);
}

export async function uploadRowForKey(objectKey: string) {
	const rows = await withSql(
		(sql) => sql<{ id: string; userId: string; purpose: string; bytes: number }[]>`
			select id, user_id as "userId", purpose, bytes from image_upload where object_key = ${objectKey}
		`
	);
	return rows[0] ?? null;
}

export async function pendingDeletion(objectKey: string) {
	const rows = await withSql(
		(sql) => sql<{ id: string }[]>`select id from pending_object_deletion where object_key = ${objectKey}`
	);
	return rows.length > 0;
}

/** Stands in for saved portraits without uploading megabytes of images. */
export async function setCharacterImageBytes(characterId: string, bytes: number) {
	await withSql((sql) => sql`update character set image_bytes = ${bytes} where id = ${characterId}`);
}

export interface LogDraftRow {
	id: string;
	userId: string;
	data: {
		name: string;
		date: number | null;
		description: string;
		dm: { name: string; DCI: string };
		magicItemsGained: { id: string; name: string }[];
	};
}

export async function logDraftRow(id: string) {
	const rows = await withSql((sql) => sql<LogDraftRow[]>`select id, user_id as "userId", data from log_draft where id = ${id}`);
	return rows[0] ?? null;
}

/** Runs what the daily `delete-expired-log-drafts` pg_cron job runs. Returns the number deleted. */
export async function deleteExpiredLogDrafts() {
	const rows = await withSql((sql) => sql<{ deleted: number }[]>`select public.delete_expired_log_drafts() as deleted`);
	return rows[0]?.deleted ?? 0;
}

export async function logDraftExpiryJob() {
	const rows = await withSql(
		(sql) => sql<{ schedule: string; command: string; active: boolean }[]>`
			select schedule, command, active from cron.job where jobname = 'delete-expired-log-drafts'
		`
	);
	return rows;
}

/** Ages a draft past its 14-day lifetime without waiting for the daily cleanup job. */
export async function expireLogDraft(id: string) {
	await withSql((sql) => sql`update log_draft set updated_at = now() - interval '15 days' where id = ${id}`);
}

export async function dmsForUser(userId: string) {
	return withSql(
		(sql) => sql<DmRow[]>`
			select id, name, "DCI", user_id as "userId", is_user as "isUser"
			from dungeonmaster
			where user_id = ${userId}
			order by name
		`
	);
}

/** App ids are UUIDv7, and the log form rejects any other DM id. */
export async function insertDm(userId: string, name: string, DCI: string) {
	const id = v7();
	await withSql(
		(sql) => sql`
			insert into dungeonmaster (id, name, "DCI", user_id, is_user)
			values (${id}, ${name}, ${DCI}, ${userId}, false)
		`
	);
	return id;
}

export async function setBanned(userId: string, banned: boolean) {
	await withSql((sql) => sql`update "user" set banned = ${banned} where id = ${userId}`);
}
