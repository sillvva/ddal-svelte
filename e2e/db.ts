import postgres from "postgres";

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

export async function setBanned(userId: string, banned: boolean) {
	await withSql((sql) => sql`update "user" set banned = ${banned} where id = ${userId}`);
}
