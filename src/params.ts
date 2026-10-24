import { characterIdParamSchema, dungeonMasterIdSchema, logIdParamSchema } from "#lib/schemas.js";
import { defineParams } from "@sveltejs/kit/params";
import * as v from "valibot";

export const params = defineParams({
	CharacterId: (param) => v.parse(v.optional(characterIdParamSchema), param),
	DMId: (param) => v.parse(v.optional(dungeonMasterIdSchema), param),
	LogId: (param) => v.parse(v.optional(logIdParamSchema), param)
});
