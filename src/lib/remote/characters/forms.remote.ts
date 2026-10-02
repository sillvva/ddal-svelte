import { BLANK_CHARACTER } from "#lib/constants.js";
import * as API from "#lib/remote/index.js";
import { characterIdParamSchema, editCharacterSchema } from "#lib/schemas.js";
import { guardedForm, guardedQuery, refreshAll } from "#lib/server/effect/guarded.js";
import { CharacterService } from "#lib/server/effect/services/characters.js";
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

	const { firstLog, ...data } = input;

	const preexisting = yield* Characters.get
		.all(user.id, { characterId: data.id })
		.pipe(Effect.map((characters) => characters.length > 0));

	const issues: StandardSchemaV1.Issue[] = [];

	if (data.imageUrl) {
		const result = yield* isValidUrl(data.imageUrl);
		if (!result) issues.push(issue.imageUrl("URL appears to be broken"));
	} else {
		data.imageUrl = BLANK_CHARACTER;
	}

	if (data.characterSheetUrl) {
		const result = yield* isValidUrl(data.characterSheetUrl);
		if (!result) issues.push(issue.characterSheetUrl("URL appears to be broken"));
	}

	if (issues.length) invalid(...issues);

	const result = yield* Characters.save(data, user.id).pipe(Effect.tapError((err) => Effect.fail(invalid(err.message))));

	if (preexisting) {
		yield* refreshAll(API.characters.queries.get({ param: data.id }).refresh());
	}

	if (firstLog && !preexisting) {
		redirect(303, `/characters/${result.id}/log/new?firstLog=true`);
	} else {
		redirect(303, `/characters/${result.id}`);
	}
});
