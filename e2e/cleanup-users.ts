import postgres from "postgres";
import { assertLocalE2E, loadLocalEnv } from "./env.ts";
import { readState, resetState } from "./state.ts";
import { deleteObject, isAppImageKey, keyFromPublicUrl, listUserObjects } from "./storage.ts";

const EMPTY_ID = "00000000-0000-7000-8000-000000000000";

export interface CleanupResult {
	users: number;
	objects: number;
}

export async function cleanupLeftoverE2EUsers(): Promise<CleanupResult> {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is not set. REMOTE_DB_URL is never used.");

	const sql = postgres(databaseUrl, { prepare: false, max: 1 });
	try {
		const extraIds = readState().userIds;
		const ids = extraIds.length ? extraIds : [EMPTY_ID];
		const users = await sql<{ id: string }[]>`
			select id
			from "user"
			where name like 'e2e-%'
				or email like 'e2e-%@%'
				or id in ${sql(ids)}
		`;
		const targets = new Set<string>([...users.map((user) => user.id), ...extraIds]);
		let objects = 0;
		for (const id of targets) {
			objects += await deleteUserData(sql, id);
		}
		return { users: users.length, objects };
	} finally {
		await sql.end();
	}
}

export async function globalCleanup() {
	loadLocalEnv();
	assertLocalE2E(process.env);
	const result = await cleanupLeftoverE2EUsers();
	if (result.users || result.objects) {
		console.log(`Cleared ${result.users} leftover e2e user(s) and ${result.objects} stored image(s) before the run.`);
	}
	resetState();
}

async function deleteUserData(sql: postgres.Sql, userId: string) {
	const keys = new Set<string>();
	for (const key of await knownKeys(sql, userId)) keys.add(key);
	try {
		for (const key of await listUserObjects(userId)) keys.add(key);
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : "Could not list stored images";
		console.warn(`Could not list images for ${userId}: ${message}`);
	}

	let objects = 0;
	for (const key of keys) {
		if (!isAppImageKey(key)) continue;
		if (await deleteObject(key)) objects += 1;
	}

	const userPrefix = `users/${userId}/%`;
	const temporaryPrefix = `tmp/users/${userId}/%`;
	await sql.begin(async (tx) => {
		await tx`
			delete from log
			where "dungeonMasterId" in (select id from dungeonmaster where user_id = ${userId})
				or "characterId" in (select id from character where "userId" = ${userId})
		`;
		await tx`
			delete from pending_object_deletion
			where object_key like ${userPrefix}
				or object_key like ${temporaryPrefix}
		`;
		await tx`delete from "user" where id = ${userId}`;
	});

	try {
		for (const key of await listUserObjects(userId)) {
			if (await deleteObject(key)) objects += 1;
		}
	} catch {
		// The first list already warned. Known keys were deleted above.
	}
	return objects;
}

async function knownKeys(sql: postgres.Sql, userId: string) {
	const uploads = await sql<{ object_key: string }[]>`
		select object_key from image_upload where user_id = ${userId}
	`;
	const portraits = await sql<{ image_url: string }[]>`
		select image_url from character where "userId" = ${userId}
	`;
	const avatars = await sql<{ image: string | null }[]>`
		select image from "user" where id = ${userId}
	`;
	const keys = new Set<string>();
	for (const row of uploads) {
		if (isAppImageKey(row.object_key)) keys.add(row.object_key);
	}
	for (const row of portraits) addUrl(keys, row.image_url);
	for (const row of avatars) {
		if (row.image) addUrl(keys, row.image);
	}
	return [...keys];
}

function addUrl(keys: Set<string>, imageUrl: string) {
	try {
		const key = keyFromPublicUrl(imageUrl);
		if (key && isAppImageKey(key)) keys.add(key);
	} catch {
		// A blank local portrait is not an R2 object.
	}
}

export async function assertUserGone(userId: string) {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is not set");
	const sql = postgres(databaseUrl, { prepare: false, max: 1 });
	try {
		const [user] = await sql<{ count: number }[]>`select count(*)::int as count from "user" where id = ${userId}`;
		const [uploads] = await sql<{ count: number }[]>`
			select count(*)::int as count from image_upload where user_id = ${userId}
		`;
		const [characters] = await sql<{ count: number }[]>`
			select count(*)::int as count from character where "userId" = ${userId}
		`;
		const [dms] = await sql<{ count: number }[]>`
			select count(*)::int as count from dungeonmaster where user_id = ${userId}
		`;
		const [passkeys] = await sql<{ count: number }[]>`
			select count(*)::int as count from passkey where "userId" = ${userId}
		`;
		const [sessions] = await sql<{ count: number }[]>`
			select count(*)::int as count from session where "userId" = ${userId}
		`;
		const pending = await sql<{ count: number }[]>`
			select count(*)::int as count
			from pending_object_deletion
			where object_key like ${`users/${userId}/%`}
				or object_key like ${`tmp/users/${userId}/%`}
		`;
		const counts = {
			user: user?.count ?? 0,
			uploads: uploads?.count ?? 0,
			characters: characters?.count ?? 0,
			dms: dms?.count ?? 0,
			passkeys: passkeys?.count ?? 0,
			sessions: sessions?.count ?? 0,
			pending: pending[0]?.count ?? 0
		};
		const leftover = Object.entries(counts).filter(([, count]) => count > 0);
		if (leftover.length) {
			throw new Error(`Account deletion left rows behind: ${leftover.map(([name, count]) => `${name}=${count}`).join(", ")}`);
		}
	} finally {
		await sql.end();
	}
}

export async function userIdForSessionCookies(cookies: { name: string; value: string }[]) {
	const tokens = new Set<string>();
	for (const cookie of cookies) {
		// better-auth stores the raw token in `session.sessionToken` and sets
		// `better-auth.session_token` to `${token}.${base64Signature}`.
		if (!cookie.name.toLowerCase().includes("session_token")) continue;
		let value;
		try {
			value = decodeURIComponent(cookie.value);
		} catch {
			value = cookie.value;
		}
		tokens.add(value);
		const dot = value.lastIndexOf(".");
		if (dot > 0) tokens.add(value.slice(0, dot));
	}
	if (!tokens.size) return null;

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is not set");
	const sql = postgres(databaseUrl, { prepare: false, max: 1 });
	try {
		const rows = await sql<{ id: string }[]>`
			select u.id
			from "user" u
			join "session" s on s."userId" = u.id
			where s."sessionToken" in ${sql([...tokens])}
			limit 1
		`;
		return rows[0]?.id ?? null;
	} finally {
		await sql.end();
	}
}
