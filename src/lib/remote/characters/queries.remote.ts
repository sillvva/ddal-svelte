import { defaultCharacter } from "#lib/entities.js";
import { characterIdParamSchema, draftCacheKey } from "#lib/schemas.js";
import { RedirectError } from "#lib/server/effect/errors.js";
import { guardedQuery } from "#lib/server/effect/guarded.js";
import { run } from "#lib/server/effect/runtime.js";
import { CharacterService } from "#lib/server/effect/services/characters.js";
import { getRequestEvent, query } from "$app/server";
import { redirect } from "@sveltejs/kit";
import * as v from "valibot";

export const getAll = guardedQuery(function* ({ user }) {
	const Characters = yield* CharacterService;
	return yield* Characters.get.all(user.id);
});

export const getAllSelect = guardedQuery(function* ({ user }) {
	const Characters = yield* CharacterService;
	return yield* Characters.get.select(user.id);
});

// eslint-disable-next-line custom/enforce-guarded-functions
export const get = query(
	v.object({
		param: characterIdParamSchema,
		newRedirect: v.optional(v.boolean(), false),
		draft: draftCacheKey
	}),
	(input) =>
		run(function* () {
			const Character = yield* CharacterService;
			const { locals } = getRequestEvent();

			if (input.param === "new" && input.newRedirect) {
				const draft = input.draft ? `?draft=${encodeURIComponent(input.draft)}` : "";
				redirect(302, `/characters/new/edit${draft}`);
			}

			const character =
				input.param === "new"
					? locals.user
						? defaultCharacter(locals.user)
						: yield* new RedirectError({ message: "Must be logged in to create a character", redirectTo: "/" })
					: yield* Character.get.one(input.param);

			return character;
		})
);
