import type { ProviderId } from "$lib/constants";
import type { UserId } from "$lib/schemas";
import { db } from "$server/db";
import { DBService, FormError } from "$server/db/effect";
import { accounts, type UpdateAccount, type User } from "$server/db/schema";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

class UserError extends FormError<User> {}
function createUserError(err: unknown): UserError {
	return UserError.from(err);
}

export function unlinkProvider(userId: UserId, provider: ProviderId) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		const result = yield* Effect.tryPromise({
			try: () =>
				db
					.delete(accounts)
					.where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
					.returning({ userId: accounts.userId, provider: accounts.provider }),
			catch: createUserError
		});

		return result.length > 0;
	});
}

interface AccountData extends UpdateAccount {
	provider: ProviderId;
	providerAccountId: string;
}

export async function updateAccount(account: AccountData) {
	try {
		const { userId, provider, providerAccountId, ...rest } = account;
		return await db
			.update(accounts)
			.set(rest)
			.where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)))
			.returning()
			.then((res) => res[0]);
	} catch (e) {
		throw new Error("Could not update account");
	}
}
