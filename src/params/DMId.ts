import { dungeonMasterIdSchema, type DungeonMasterId } from "$lib/schemas";
import type { ParamMatcher } from "@sveltejs/kit";
import * as v from "valibot";

export const match = ((param: string): param is DungeonMasterId => {
	return v.safeParse(dungeonMasterIdSchema, param).success;
}) satisfies ParamMatcher;
