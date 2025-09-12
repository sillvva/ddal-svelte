import { logIdParamSchema, type LogIdParam } from "$lib/schemas";
import type { ParamMatcher } from "@sveltejs/kit";
import * as v from "valibot";

export const match = ((param: string): param is LogIdParam => {
	return v.safeParse(logIdParamSchema, param).success;
}) satisfies ParamMatcher;
