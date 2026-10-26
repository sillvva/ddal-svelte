import { completeCharacterImageSchema } from "#lib/schemas.js";
import { run } from "#lib/server/effect/runtime.js";
import { StorageService } from "#lib/server/effect/services/storage.js";
import { error } from "@sveltejs/kit";
import { safeParse } from "valibot";

/** Deletes an upload when the edit form is left before save. Uses fetch keepalive from the browser. */
export const POST = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) error(401, "Unauthorized");

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, "Invalid upload");
	}

	const parsed = safeParse(completeCharacterImageSchema, body);
	if (!parsed.success) error(400, "Invalid upload");

	await run(function* () {
		const Storage = yield* StorageService;
		yield* Storage.releaseUnsaved(user.id, parsed.output.uploadId);
	});

	return new Response(null, { status: 204 });
};
