import { characterIdSchema, type CharacterId } from "$lib/schemas";
import type { ParamMatcher } from "@sveltejs/kit";
import * as v from "valibot";

export const match = ((param: string): param is CharacterId | "new" => {
	return v.safeParse(v.union([characterIdSchema, v.literal("new")]), param).success;
}) satisfies ParamMatcher;
