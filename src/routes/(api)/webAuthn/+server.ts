import { authName } from "$lib/auth";
import { db, q } from "$server/db/index";
import { passkey } from "$server/db/schema";
import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";

export type RenameWebAuthnResponse = { success: true; name: string } | { success: false; error: string; throw?: boolean };
export type RenameWebAuthnInput = { name: string; id?: string };
export async function POST({ request, locals }) {
	const user = locals.user;
	if (!user?.id) return json({ success: false, error: "Unauthorized" }, { status: 401 });

	let { name, id } = (await request.json()) as RenameWebAuthnInput;

	try {
		const passkeys = await q.passkey.findMany({
			where: {
				userId: {
					eq: user.id
				}
			}
		});

		const auth = passkeys.find((a) => (id ? a.id === id : a.name === ""));
		if (!auth) return json({ success: false, error: "No passkey found", throw: true }, { status: 404 });
		if (!name.trim()) name = authName(auth);

		const existing = passkeys.find((a) => a.name === name);
		if (existing && (!auth.name || (id && existing.id !== id))) throw new Error("Name already exists");

		await db
			.update(passkey)
			.set({ name: name.trim() })
			.where(and(eq(passkey.id, auth.id)));

		return json({ success: true, name } satisfies RenameWebAuthnResponse);
	} catch (e) {
		if (e instanceof Error) return json({ success: false, error: e.message } satisfies RenameWebAuthnResponse, { status: 500 });
		else {
			console.error(e);
			return json({ success: false, error: "Unknown error" } satisfies RenameWebAuthnResponse, { status: 500 });
		}
	}
}

export type DeleteWebAuthnResponse = { success: true } | { success: false; error: string };
export type DeleteWebAuthnInput = { id: string };
export async function DELETE({ request, locals }) {
	try {
		const user = locals.user;
		if (!user?.id) return json({ success: false, error: "Unauthorized" }, { status: 401 });

		const { id } = (await request.json()) as DeleteWebAuthnInput;
		const auth = await q.passkey.findFirst({
			where: {
				id: id,
				userId: {
					eq: user.id
				}
			}
		});

		if (!auth) return json({ success: false, error: "No passkey found" }, { status: 404 });

		await db.delete(passkey).where(and(eq(passkey.id, auth.id)));

		return json({ success: true } satisfies DeleteWebAuthnResponse);
	} catch (e) {
		if (e instanceof Error) return json({ success: false, error: e.message } satisfies DeleteWebAuthnResponse, { status: 500 });
		else {
			console.error(e);
			return json({ success: false, error: "Unknown error" } satisfies DeleteWebAuthnResponse, { status: 500 });
		}
	}
}
