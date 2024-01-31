import { providers } from "../auth";
import { revalidateKeys, type CacheKey } from "../cache";
import { getCharactersCache } from "../data/characters";
import { prisma } from "../db";

export async function clearUserCache(userId: string) {
	const characters = await getCharactersCache(userId);

	revalidateKeys([
		["dms", userId, "logs"],
		["characters", userId],
		...characters.map((c) => ["character", c.id, "logs"] as CacheKey),
		["dm-logs", userId]
	]);
}

export type ProviderId = (typeof providers)[number]["id"];
export async function unlinkProvider(userId: string, provider: ProviderId) {
	const account = await prisma.account.findFirst({
		where: { userId, provider }
	});

	if (!account) {
		throw new Error("No account found");
	}

	try {
		await prisma.account.delete({
			where: { id: account.id }
		});

		return true;
	} catch (e) {
		throw new Error("Could not unlink account");
	}
}
