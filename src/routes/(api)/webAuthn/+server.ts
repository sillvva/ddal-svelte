import { authName } from "$lib/util.js";
import { db, q } from "$server/db/index.js";
import { accounts, authenticators } from "$server/db/schema.js";
import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";

export type RenameWebAuthnResponse = { success: true; name: string } | { success: false; error: string; throw?: boolean };
export type RenameWebAuthnInput = { name: string; id?: string };
export async function POST({ request, locals }) {
	const session = locals.session;
	if (!session?.user?.id) return json({ success: false, error: "Unauthorized" }, { status: 401 });

	let { name, id } = (await request.json()) as RenameWebAuthnInput;

	try {
		const passkeys = await q.authenticators.findMany({
			where: (table, { eq, and }) => and(eq(table.userId, session.user.id))
		});

		const auth = passkeys.find((a) => (id ? a.credentialID === id : a.name === ""));
		if (!auth) return json({ success: false, error: "No passkey found", throw: true });
		if (!name.trim()) name = authName(auth);

		const existing = passkeys.find((a) => a.name === name);
		if (existing && (!auth.name || (id && existing.credentialID !== id))) throw new Error("Name already exists");

		await db
			.update(authenticators)
			.set({ name })
			.where(and(eq(authenticators.userId, auth.userId), eq(authenticators.providerAccountId, auth.providerAccountId)));

		return json({ success: true, name } satisfies RenameWebAuthnResponse);
	} catch (e) {
		if (e instanceof Error) return json({ success: false, error: e.message } satisfies RenameWebAuthnResponse);
		else {
			console.error(e);
			return json({ success: false, error: "Unknown error" } satisfies RenameWebAuthnResponse);
		}
	}
}

export type DeleteWebAuthnResponse = { success: true } | { success: false; error: string };
export type DeleteWebAuthnInput = { id: string };
export async function DELETE({ request, locals }) {
	try {
		const session = locals.session;
		if (!session?.user?.id) return json({ success: false, error: "Unauthorized" }, { status: 401 });

		const { id } = (await request.json()) as DeleteWebAuthnInput;
		const auth = await q.authenticators.findFirst({
			where: (table, { eq }) => eq(table.userId, session.user.id) && eq(table.credentialID, id)
		});

		if (!auth) throw new Error("No passkey found");

		await db
			.delete(accounts)
			.where(and(eq(accounts.userId, auth.userId), eq(accounts.providerAccountId, auth.providerAccountId)));

		return json({ success: true } satisfies DeleteWebAuthnResponse);
	} catch (e) {
		if (e instanceof Error) return json({ success: false, error: e.message } satisfies DeleteWebAuthnResponse);
		else {
			console.error(e);
			return json({ success: false, error: "Unknown error" } satisfies DeleteWebAuthnResponse);
		}
	}
}
