import { logIdSchema, type LogId } from "$lib/schemas";
import type { ParamMatcher } from "@sveltejs/kit";
import * as v from "valibot";

export const match = ((param: string): param is LogId | "new" => {
	return v.safeParse(v.union([logIdSchema, v.literal("new")]), param).success;
}) satisfies ParamMatcher;
