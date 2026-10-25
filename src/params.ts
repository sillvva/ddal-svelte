import { defineParams } from "@sveltejs/kit/params";
import * as v from "valibot";

const uuidV7 = v.pipe(v.string(), v.regex(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[\da-f]{4}-[\da-f]{12}$/iu));

export const params = defineParams({
	CharacterId: v.union([v.pipe(uuidV7, v.brand("CharacterId")), v.literal("new")]),
	DMId: v.pipe(uuidV7, v.brand("DungeonMasterId")),
	LogId: v.union([v.pipe(uuidV7, v.brand("LogId")), v.literal("new")])
});
