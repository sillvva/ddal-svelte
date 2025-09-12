import { characterIdParamSchema, type CharacterIdParam } from "$lib/schemas";
import type { ParamMatcher } from "@sveltejs/kit";
import * as v from "valibot";

export const match = ((param: string): param is CharacterIdParam => {
	return v.safeParse(characterIdParamSchema, param).success;
}) satisfies ParamMatcher;
