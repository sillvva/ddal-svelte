import { type DungeonMasterId, type DungeonMasterSchema } from "$lib/schemas";
import { getUserDMs, type UserDMs } from "$server/data/dms";
import { buildConflictUpdateColumns } from "$server/db";
import { DBService, FormError } from "$server/db/effect";
import { dungeonMasters } from "$server/db/schema";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

class SaveDMError extends FormError<DungeonMasterSchema> {}
function createDMError(err: unknown): SaveDMError {
	return SaveDMError.from(err);
}

export function saveDM(dmId: DungeonMasterId, user: LocalsSession["user"], data: DungeonMasterSchema) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		const [dm] = yield* getUserDMs(user, { id: dmId }).pipe(Effect.catchAll(createDMError));
		if (!dm) return yield* new SaveDMError("DM does not exist", { status: 404 });

		if (!data.name.trim()) {
			if (dm.isUser) data.name = user.name;
			else return yield* new SaveDMError("Name is required", { status: 400, field: "name" });
		}

		return yield* Effect.tryPromise({
			try: () =>
				db
					.update(dungeonMasters)
					.set({
						name: data.name,
						DCI: data.DCI || null
					})
					.where(eq(dungeonMasters.id, dmId))
					.returning(),
			catch: createDMError
		}).pipe(Effect.flatMap((c) => (c ? Effect.succeed(c) : Effect.fail(new SaveDMError("Failed to save DM")))));
	});
}

export function createUserDM(user: LocalsSession["user"]) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		return yield* Effect.tryPromise({
			try: () =>
				db
					.insert(dungeonMasters)
					.values({
						name: user.name,
						DCI: null,
						userId: user.id,
						isUser: true
					})
					.onConflictDoUpdate({
						target: [dungeonMasters.userId, dungeonMasters.isUser],
						set: buildConflictUpdateColumns(dungeonMasters, ["name"])
					})
					.returning(),
			catch: createDMError
		}).pipe(
			Effect.map((dms) => dms[0]),
			Effect.flatMap((dm) => (dm ? Effect.succeed(dm) : Effect.fail(new SaveDMError("Failed to create DM"))))
		);
	});
}

export function deleteDM(dm: UserDMs[number]) {
	return Effect.gen(function* () {
		if (dm.logs.length) return yield* new SaveDMError("You cannot delete a DM that has logs", { status: 400 });

		const Database = yield* DBService;
		const db = yield* Database.db;

		return yield* Effect.tryPromise({
			try: () => db.delete(dungeonMasters).where(eq(dungeonMasters.id, dm.id)).returning({ id: dungeonMasters.id }),
			catch: createDMError
		}).pipe(Effect.flatMap((result) => (result ? Effect.succeed(result) : Effect.fail(new SaveDMError("Failed to delete DM")))));
	});
}
