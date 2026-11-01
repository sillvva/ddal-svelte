import { BLANK_CHARACTER } from "#lib/constants.js";
import * as API from "#lib/remote/index.js";
import { characterIdParamSchema, draftCacheKey, editCharacterSchema } from "#lib/schemas.js";
import { guardedForm, guardedQuery, refreshAll } from "#lib/server/effect/guarded.js";
import { CharacterNotFoundError, CharacterService } from "#lib/server/effect/services/characters.js";
import { StorageService } from "#lib/server/effect/services/storage.js";
import { ImageUploadError } from "#lib/server/images/errors.js";
import { isValidUrl } from "#lib/server/effect/util.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { invalid, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";
import * as queries from "./queries.remote";

const newCharacterQuery = v.object({
	param: characterIdParamSchema,
	draft: draftCacheKey
});

export const get = guardedQuery(newCharacterQuery, function* (input, { event, user }) {
	const firstLog = event.locals.app.characters.firstLog;
	// `queries.get` mints the id when `param` is "new". That call has to carry `draft`,
	// or this wrapper re-runs and still receives the id from the previous visit.
	// Existing characters keep the key the rest of the app refreshes.
	const character = yield* Effect.tryPromise(() =>
		queries.get(input.param === "new" ? { param: input.param, draft: input.draft } : { param: input.param })
	);
	// Character pages are public, so `queries.get` does not filter by owner.
	if (character.userId !== user.id) return yield* new CharacterNotFoundError();

	return {
		id: character.id,
		name: character.name,
		race: character.race,
		class: character.class,
		campaign: character.campaign,
		characterSheetUrl: character.characterSheetUrl,
		imageUrl: character.imageUrl === BLANK_CHARACTER ? "" : character.imageUrl,
		firstLog: firstLog && input.param === "new"
	};
});

export const save = guardedForm(editCharacterSchema, function* (input, { user, issue }) {
	const Characters = yield* CharacterService;
	const Storage = yield* StorageService;

	const { firstLog, ...data } = input;

	const existing = yield* Characters.get.all(user.id, { characterId: data.id, includeLogs: false });
	const preexisting = existing.length > 0;

	const issues: StandardSchemaV1.Issue[] = [];

	if (!data.imageUrl) data.imageUrl = BLANK_CHARACTER;

	const stored = yield* Storage.resolveForSave({
		userId: user.id,
		characterId: data.id,
		imageUrl: data.imageUrl
	}).pipe(Effect.tapError((error) => Effect.fail(invalid(issue.imageUrl(error.message)))));

	if (!stored.owned && data.imageUrl !== BLANK_CHARACTER) {
		const result = yield* isValidUrl(data.imageUrl);
		if (!result) issues.push(issue.imageUrl("URL appears to be broken"));
	}

	if (data.characterSheetUrl) {
		const result = yield* isValidUrl(data.characterSheetUrl);
		if (!result) issues.push(issue.characterSheetUrl("URL appears to be broken"));
	}

	if (issues.length) invalid(...issues);

	data.imageUrl = stored.imageUrl;

	const result = yield* Characters.save(data, user.id, stored.copy).pipe(
		Effect.tapError((err) => Effect.fail(invalid(err instanceof ImageUploadError ? issue.imageUrl(err.message) : err.message)))
	);

	yield* Storage.cleanupAfterSave(stored.copy?.from ?? null);

	// The character page reads `get({ param, newRedirect: true })`. The log page reads
	// `get({ param })`. Those are different cache keys, and an explicit refresh skips
	// invalidateAll, so a save has to refresh both or the page keeps the previous character.
	yield* refreshAll(
		API.images.queries.storage().refresh(),
		API.characters.queries.getAll().refresh(),
		API.characters.queries.get({ param: result.id }).refresh(),
		API.characters.queries.get({ param: result.id, newRedirect: true }).refresh()
	);

	if (firstLog && !preexisting) {
		redirect(303, `/characters/${result.id}/log/new?firstLog=true`);
	} else {
		redirect(303, `/characters/${result.id}`);
	}
});
