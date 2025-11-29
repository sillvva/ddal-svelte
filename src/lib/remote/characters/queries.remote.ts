import { getRequestEvent, query } from "$app/server";
import { defaultCharacter } from "$lib/entities";
import { characterIdParamSchema } from "$lib/schemas";
import { RedirectError } from "$lib/server/effect/errors";
import { guardedQuery } from "$lib/server/effect/remote";
import { run } from "$lib/server/effect/runtime";
import { CharacterService } from "$lib/server/effect/services/characters";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";

export const getAll = guardedQuery(function* ({ user }) {
	const Characters = yield* CharacterService;
	return yield* Characters.get.all(user.id);
});

export const getAllSelect = guardedQuery(function* ({ user }) {
	const Characters = yield* CharacterService;
	return yield* Characters.get.all(user.id).pipe(Effect.map((characters) => characters.map((c) => ({ id: c.id, name: c.name }))));
});

// eslint-disable-next-line custom/enforce-guarded-functions
export const get = query(
	v.object({
		param: characterIdParamSchema,
		newRedirect: v.optional(v.boolean(), false)
	}),
	(input) =>
		run(function* () {
			const Character = yield* CharacterService;
			const { locals } = getRequestEvent();

			if (input.param === "new" && input.newRedirect) redirect(302, "/characters/new/edit");

			const character =
				input.param === "new"
					? locals.user
						? defaultCharacter(locals.user)
						: yield* new RedirectError({ message: "Must be logged in to create a character", redirectTo: "/" })
					: yield* Character.get.one(input.param);

			return character;
		})
);
