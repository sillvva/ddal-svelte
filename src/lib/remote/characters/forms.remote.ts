import { BLANK_CHARACTER } from "#lib/constants.js";
import * as API from "#lib/remote/index.js";
import { characterIdParamSchema, editCharacterSchema } from "#lib/schemas.js";
import { guardedForm, guardedQuery, refreshAll } from "#lib/server/effect/guarded.js";
import { CharacterService } from "#lib/server/effect/services/characters.js";
import { StorageService } from "#lib/server/effect/services/storage.js";
import { ImageUploadError } from "#lib/server/images/errors.js";
import { isValidUrl } from "#lib/server/effect/util.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { invalid, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as queries from "./queries.remote";

export const get = guardedQuery(characterIdParamSchema, function* (input, { event }) {
	const firstLog = event.locals.app.characters.firstLog;
	const character = yield* Effect.tryPromise(() => queries.get({ param: input }));

	return {
		id: character.id,
		name: character.name,
		race: character.race,
		class: character.class,
		campaign: character.campaign,
		characterSheetUrl: character.characterSheetUrl,
		imageUrl: character.imageUrl === BLANK_CHARACTER ? "" : character.imageUrl,
		firstLog: firstLog && input === "new"
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

	if (preexisting) {
		yield* refreshAll(API.characters.queries.get({ param: data.id }).refresh());
	}

	if (firstLog && !preexisting) {
		redirect(303, `/characters/${result.id}/log/new?firstLog=true`);
	} else {
		redirect(303, `/characters/${result.id}`);
	}
});
