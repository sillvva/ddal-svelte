import { authName } from "$lib/util.js";
import { db, q } from "$server/db/index.js";
import { passkey } from "$server/db/schema.js";
import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";

export type RenameWebAuthnResponse = { success: true; name: string } | { success: false; error: string; throw?: boolean };
export type RenameWebAuthnInput = { name: string; id?: string };
export async function POST({ request, locals }) {
	const session = locals.session;
	if (!session?.user?.id) return json({ success: false, error: "Unauthorized" }, { status: 401 });

	let { name, id } = (await request.json()) as RenameWebAuthnInput;

	try {
		const passkeys = await q.passkey.findMany({
			where: {
				userId: {
					eq: session.user.id
				}
			}
		});

		const auth = passkeys.find((a) => (id ? a.id === id : a.name === ""));
		if (!auth) return json({ success: false, error: "No passkey found", throw: true });
		if (!name.trim()) name = authName(auth);

		const existing = passkeys.find((a) => a.name === name);
		if (existing && (!auth.name || (id && existing.id !== id))) throw new Error("Name already exists");

		await db
			.update(passkey)
			.set({ name: name.trim() })
			.where(and(eq(passkey.id, auth.id)));

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
		const auth = await q.passkey.findFirst({
			where: {
				id: id,
				userId: {
					eq: session.user.id
				}
			}
		});

		if (!auth) throw new Error("No passkey found");

		await db.delete(passkey).where(and(eq(passkey.id, auth.id)));

		return json({ success: true } satisfies DeleteWebAuthnResponse);
	} catch (e) {
		if (e instanceof Error) return json({ success: false, error: e.message } satisfies DeleteWebAuthnResponse);
		else {
			console.error(e);
			return json({ success: false, error: "Unknown error" } satisfies DeleteWebAuthnResponse);
		}
	}
}
