import type { ProviderId } from "$lib/constants";
import type { UserId } from "$lib/schemas";
import type { Prettify } from "$lib/util";
import { db } from "$server/db";
import { accounts, type UpdateAccount } from "$server/db/schema";
import { and, eq } from "drizzle-orm";

export async function unlinkProvider(userId: UserId, provider: ProviderId) {
	try {
		const result = await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
		return result.count > 0;
	} catch (e) {
		throw new Error("Could not unlink account");
	}
}

type AccountData = Prettify<
	Omit<UpdateAccount, "provider" | "providerAccountId"> & { provider: ProviderId; providerAccountId: string }
>;
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
