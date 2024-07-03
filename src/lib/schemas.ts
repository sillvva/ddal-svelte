import type { CharacterData } from "$server/data/characters";
import * as v from "valibot";

export type BrandedType = v.InferOutput<ReturnType<typeof brandedId>>;
function brandedId<T extends string>(name: T) {
	return v.pipe(v.string(), v.brand(name));
}

function optOrNull<T extends v.GenericSchema>(schema: T) {
	return v.optional(v.union([schema, v.null_()]), null);
}

const required = v.minLength<string, 1, string>(1, "Required");
const maxTextSize = v.maxLength<string, 5000, string>(5000, `Must be less than 5000 characters`);
const maxStringSize = v.maxLength<string, 255, string>(255, "Must be less than 255 characters");

const urlSchema = v.pipe(v.string(), v.url(), maxStringSize);
const optionalURL = v.optional(v.fallback(urlSchema, ""), "");
const requiredString = v.pipe(v.string(), required);

export type EnvPrivate = v.InferInput<typeof envPrivateSchema>;
export const envPrivateSchema = v.object({
	DATABASE_URL: urlSchema,
	AUTH_SECRET: v.pipe(v.string(), v.minLength(10, "Must be a string of at least 10 characters")),
	GOOGLE_CLIENT_ID: requiredString,
	GOOGLE_CLIENT_SECRET: requiredString,
	DISCORD_CLIENT_ID: requiredString,
	DISCORD_CLIENT_SECRET: requiredString,
	DISABLE_SIGNUPS: v.optional(v.boolean(), false),
});

export type EnvPublic = v.InferInput<typeof envPublicSchema>;
export const envPublicSchema = v.object({
	PUBLIC_URL: urlSchema,
	PUBLIC_TEST_URL: v.optional(v.string(), "")
});

export type UserId = v.InferOutput<typeof userIdSchema>;
export const userIdSchema = brandedId("UserId");

export type NewCharacterSchema = v.InferOutput<typeof newCharacterSchema>;
export const newCharacterSchema = v.object({
	name: requiredString,
	campaign: v.optional(v.pipe(v.string(), maxStringSize), ""),
	race: v.optional(v.pipe(v.string(), maxStringSize), ""),
	class: v.optional(v.pipe(v.string(), maxStringSize), ""),
	characterSheetUrl: optionalURL,
	imageUrl: optionalURL
});

export type CharacterId = v.InferOutput<typeof characterIdSchema>;
export const characterIdSchema = brandedId("CharacterId");

export type EditCharacterSchema = v.InferOutput<typeof editCharacterSchema>;
export const editCharacterSchema = v.object({ id: characterIdSchema, ...newCharacterSchema.entries });

export type DungeonMasterId = v.InferOutput<typeof dungeonMasterIdSchema>;
export const dungeonMasterIdSchema = brandedId("DungeonMasterId");

export type DungeonMasterSchema = v.InferOutput<typeof dungeonMasterSchema>;
export type DungeonMasterSchemaIn = v.InferInput<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = v.object({
	id: dungeonMasterIdSchema,
	name: v.pipe(v.string(), required, maxStringSize),
	DCI: optOrNull(v.pipe(v.string(), v.regex(/[0-9]{0,10}/, "Invalid DCI Format"))),
	uid: optOrNull(userIdSchema),
	owner: userIdSchema
});

export type ItemId = v.InferOutput<typeof itemIdSchema>;
export const itemIdSchema = brandedId("ItemID");

const itemSchema = v.object({
	id: v.optional(itemIdSchema, ""),
	name: requiredString,
	description: v.optional(v.pipe(v.string(), maxTextSize), "")
});

export type LogId = v.InferOutput<typeof logIdSchema>;
export const logIdSchema = brandedId("LogId");

const int = v.pipe(v.number(), v.integer());

export type LogSchema = v.InferOutput<typeof logSchema>;
export type LogSchemaIn = v.InferInput<typeof logSchema>;
export const logSchema = v.object({
	id: v.optional(logIdSchema, ""),
	name: v.pipe(v.string(), required, maxStringSize),
	date: v.date(),
	characterId: optOrNull(characterIdSchema),
	characterName: v.optional(v.string(), ""),
	type: v.optional(v.union([v.literal("game"), v.literal("nongame")]), "game"),
	experience: v.pipe(int, v.minValue(0)),
	acp: v.pipe(int, v.minValue(0)),
	tcp: int,
	level: v.pipe(int, v.minValue(0)),
	gold: v.number(),
	dtd: int,
	description: v.optional(v.pipe(v.string(), maxTextSize), ""),
	dm: v.object({
		...dungeonMasterSchema.entries,
		name: v.optional(v.string(), "")
	}),
	isDmLog: v.optional(v.boolean(), false),
	appliedDate: v.nullable(v.date()),
	magicItemsGained: v.optional(v.array(itemSchema), []),
	magicItemsLost: v.optional(v.array(itemIdSchema), []),
	storyAwardsGained: v.optional(v.array(itemSchema), []),
	storyAwardsLost: v.optional(v.array(itemIdSchema), [])
});

export const characterLogSchema = (character: CharacterData) =>
	v.pipe(
		v.object(logSchema.entries),
		v.check((input) => !input.isDmLog, "Only character logs can be saved here."),
		v.forward(
			v.check((input) => {
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				return character.total_level < 20 || input.acp - logACP === 0;
			}, "Cannot increase level above 20"),
			["acp"]
		),
		v.forward(
			v.check((input) => {
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				return character.total_level + input.level - logLevel <= 20;
			}, "Character cannot level past 20"),
			["level"]
		)
	);

export const dMLogSchema = (character?: CharacterData) =>
	v.pipe(
		v.object(logSchema.entries),
		v.check((input) => input.isDmLog, "Only DM logs can be saved here."),
		v.forward(
			v.check((input) => !input.characterId || !!character, "Character not found"),
			["characterId"]
		),
		v.forward(
			v.check((input) => !!input.characterId || !input.appliedDate, "Character must be selected if applied date is set"),
			["characterId"]
		),
		v.forward(
			v.check((input) => !!input.appliedDate || !input.characterId, "Date must be set if applied to a character"),
			["appliedDate"]
		),
		v.forward(
			v.check(
				(input) => !input.appliedDate || (input.appliedDate.getTime() - input.date.getTime()) / 1000 > -60,
				"Applied date must be after log date"
			),
			["appliedDate"]
		),
		v.forward(
			v.check((input) => {
				if (!character) return true;
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				return character.total_level < 20 || input.acp - logACP === 0;
			}, "Cannot increase level above 20"),
			["acp"]
		),
		v.forward(
			v.check((input) => {
				if (!character) return true;
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				return character.total_level + input.level - logLevel <= 20;
			}, "Cannot increase level above 20"),
			["level"]
		)
	);
