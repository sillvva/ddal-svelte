import type { FullCharacterData } from "$server/data/characters";
import * as v from "valibot";

export type BrandedType = v.InferOutput<ReturnType<typeof brandedId>>;
function brandedId<T extends string>(name: T) {
	return v.pipe(v.string(), v.brand(name));
}

const string = v.pipe(v.string(), v.trim());
const requiredString = v.pipe(string, v.regex(/^.*(\p{L}|\p{N})+.*$/u, "Required"));
const shortString = v.pipe(string, v.maxLength(50));
const maxTextSize = v.pipe(string, v.maxLength(5000));
const maxStringSize = v.pipe(string, v.maxLength(255));
const integer = v.pipe(v.number(), v.integer());

const urlSchema = v.pipe(string, v.url(), v.maxLength(500));
const optionalURL = v.optional(v.fallback(urlSchema, ""), "");

export type EnvPrivate = v.InferInput<typeof envPrivateSchema>;
export const envPrivateSchema = v.object({
	DATABASE_URL: urlSchema,
	AUTH_SECRET: v.pipe(string, v.minLength(10)),
	GOOGLE_CLIENT_ID: requiredString,
	GOOGLE_CLIENT_SECRET: requiredString,
	DISCORD_CLIENT_ID: requiredString,
	DISCORD_CLIENT_SECRET: requiredString,
	DISABLE_SIGNUPS: v.optional(v.boolean(), false)
});

export type EnvPublic = v.InferInput<typeof envPublicSchema>;
export const envPublicSchema = v.object({
	// PUBLIC_URL: urlSchema,
	PUBLIC_TEST_URL: v.optional(string, "")
});

export type UserId = v.InferOutput<typeof userIdSchema>;
export const userIdSchema = brandedId("UserId");

export type NewCharacterSchema = v.InferOutput<typeof newCharacterSchema>;
export const newCharacterSchema = v.object({
	name: v.pipe(requiredString, shortString),
	campaign: v.optional(shortString, ""),
	race: v.optional(shortString, ""),
	class: v.optional(shortString, ""),
	characterSheetUrl: optionalURL,
	imageUrl: optionalURL
});

export type CharacterId = v.InferOutput<typeof characterIdSchema>;
export const characterIdSchema = brandedId("CharacterId");

export type EditCharacterSchema = v.InferOutput<typeof editCharacterSchema>;
export const editCharacterSchema = v.object({
	id: characterIdSchema,
	...newCharacterSchema.entries,
	firstLog: v.optional(v.boolean(), false)
});

export type DungeonMasterId = v.InferOutput<typeof dungeonMasterIdSchema>;
export const dungeonMasterIdSchema = brandedId("DungeonMasterId");

export type DungeonMasterSchema = v.InferOutput<typeof dungeonMasterSchema>;
export type DungeonMasterSchemaIn = v.InferInput<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = v.object({
	id: v.optional(dungeonMasterIdSchema, ""),
	name: v.pipe(requiredString, shortString),
	DCI: v.nullish(v.pipe(string, v.regex(/\d{0,10}/, "Invalid DCI Format")), null),
	userId: userIdSchema,
	isUser: v.boolean()
});

export type ItemId = v.InferOutput<typeof itemIdSchema>;
export const itemIdSchema = brandedId("ItemID");

export type ItemSchema = v.InferOutput<typeof itemSchema>;
const itemSchema = v.object({
	id: v.optional(itemIdSchema, ""),
	name: requiredString,
	description: v.nullish(maxTextSize, null)
});

export type LogId = v.InferOutput<typeof logIdSchema>;
export const logIdSchema = brandedId("LogId");

export type LogSchema = v.InferOutput<typeof logSchema>;
export type LogSchemaIn = v.InferInput<typeof logSchema>;
export const logSchema = v.object({
	id: v.optional(logIdSchema, ""),
	name: v.pipe(requiredString, maxStringSize),
	date: v.date(),
	characterId: v.nullish(characterIdSchema, null),
	characterName: v.optional(shortString, ""),
	appliedDate: v.nullable(v.date()),
	type: v.optional(v.picklist(["game", "nongame"]), "game"),
	experience: v.nullable(v.pipe(integer, v.minValue(0)), 0),
	acp: v.nullable(v.pipe(integer, v.minValue(0)), 0),
	tcp: v.nullable(integer, 0),
	level: v.nullable(v.pipe(integer, v.minValue(0)), 0),
	gold: v.nullable(v.number(), 0),
	dtd: v.nullable(integer, 0),
	description: v.optional(maxTextSize, ""),
	dm: v.object({
		...dungeonMasterSchema.entries,
		name: v.optional(shortString, "")
	}),
	isDmLog: v.optional(v.boolean(), false),
	magicItemsGained: v.optional(v.array(itemSchema), []),
	magicItemsLost: v.optional(v.array(itemIdSchema), []),
	storyAwardsGained: v.optional(v.array(itemSchema), []),
	storyAwardsLost: v.optional(v.array(itemIdSchema), [])
});

export const characterLogSchema = (character: FullCharacterData) =>
	v.pipe(
		logSchema,
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

export const dMLogSchema = (characters: FullCharacterData[] = []) =>
	v.pipe(
		logSchema,
		v.check((input) => input.isDmLog, "Only DM logs can be saved here."),
		v.forward(
			v.check((input) => {
				const characterIds = characters.map((c) => c.id);
				return !input.characterId || !characterIds.length || characterIds.includes(input.characterId);
			}, "Character not found"),
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
				const character = characters.find((c) => c.id === input.characterId);
				if (!character) return true;
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				return character.total_level < 20 || input.acp - logACP === 0;
			}, "Cannot increase level above 20"),
			["acp"]
		),
		v.forward(
			v.check((input) => {
				const character = characters.find((c) => c.id === input.characterId);
				if (!character) return true;
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				return character.total_level + input.level - logLevel <= 20;
			}, "Cannot increase level above 20"),
			["level"]
		)
	);
