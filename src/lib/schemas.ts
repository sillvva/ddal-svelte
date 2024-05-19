import type { CharacterData } from "$server/data/characters";
import * as v from "valibot";

export type BrandedType = v.Output<ReturnType<typeof brandedId>>;
function brandedId<T extends string>(name: T, pipe: v.Pipe<string> = []) {
	return v.brand(v.string(pipe), name);
}

const required = v.minLength<string, 1>(1, "Required");
export const maxTextLength = 5000;
const maxTextSize = v.maxLength<string, typeof maxTextLength>(maxTextLength, `Must be less than ${maxTextLength} characters`);
const maxStringSize = v.maxLength<string, 255>(255, "Must be less than 255 characters");

export const envPrivateSchema = v.object({
	DATABASE_URL: v.string([v.url()]),
	UPSTASH_REDIS_REST_URL: v.string([v.url()]),
	UPSTASH_REDIS_REST_TOKEN: v.string([required]),
	AUTH_SECRET: v.string([v.minLength(10, "Must be a string of at least 10 characters")]),
	AUTH_URL: v.string([v.url()]),
	GOOGLE_CLIENT_ID: v.string([required]),
	GOOGLE_CLIENT_SECRET: v.string([required]),
	DISCORD_CLIENT_ID: v.string([required]),
	DISCORD_CLIENT_SECRET: v.string([required]),
	CRON_CHARACTER_ID: v.string([required]),
	DISABLE_SIGNUPS: v.optional(v.boolean(), false)
});

export const envPublicSchema = v.object({
	PUBLIC_URL: v.string([v.url()])
});

export type UserId = v.Output<typeof userIdSchema>;
export const userIdSchema = brandedId("UserId");

const optionalURL = v.optional(v.fallback(v.string([v.url(), maxStringSize]), ""), "");

export type NewCharacterSchema = v.Output<typeof newCharacterSchema>;
export const newCharacterSchema = v.object({
	name: v.string([required]),
	campaign: v.optional(v.string([maxStringSize]), ""),
	race: v.optional(v.string([maxStringSize]), ""),
	class: v.optional(v.string([maxStringSize]), ""),
	characterSheetUrl: optionalURL,
	imageUrl: optionalURL
});

export type CharacterId = v.Output<typeof characterIdSchema>;
export const characterIdSchema = brandedId("CharacterId");

export type EditCharacterSchema = v.Output<typeof editCharacterSchema>;
export const editCharacterSchema = v.merge([v.object({ id: characterIdSchema }), newCharacterSchema]);

export type DungeonMasterId = v.Output<typeof dungeonMasterIdSchema>;
export const dungeonMasterIdSchema = brandedId("DungeonMasterId");

export type DungeonMasterSchema = v.Output<typeof dungeonMasterSchema>;
export type DungeonMasterSchemaIn = v.Input<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = v.object({
	id: dungeonMasterIdSchema,
	name: v.string([required, maxStringSize]),
	DCI: v.nullable(v.union([v.string([v.regex(/[0-9]{0,10}/, "Invalid DCI Format")]), v.null_()]), null),
	uid: v.nullable(v.union([userIdSchema, v.null_()]), null),
	owner: userIdSchema
});

export type ItemId = v.Output<typeof itemIdSchema>;
export const itemIdSchema = brandedId("ItemID");

const itemSchema = v.object({
	id: v.optional(itemIdSchema, ""),
	name: v.string([required]),
	description: v.optional(v.string([maxTextSize]), "")
});

export type LogId = v.Output<typeof logIdSchema>;
export const logIdSchema = brandedId("LogId");

export type LogSchema = v.Output<typeof logSchema>;
export type LogSchemaIn = v.Input<typeof logSchema>;
export const logSchema = v.object({
	id: v.optional(logIdSchema, ""),
	name: v.string([required, maxStringSize]),
	date: v.date(),
	characterId: v.optional(v.union([characterIdSchema, v.null_()]), null),
	characterName: v.optional(v.string(), ""),
	type: v.optional(v.union([v.literal("game"), v.literal("nongame")]), "game"),
	experience: v.number([v.integer(), v.minValue(0)]),
	acp: v.number([v.integer(), v.minValue(0)]),
	tcp: v.number([v.integer()]),
	level: v.number([v.integer(), v.minValue(0)]),
	gold: v.number(),
	dtd: v.number([v.integer()]),
	description: v.optional(v.union([v.string([maxTextSize]), v.null_()]), ""),
	dm: v.merge([
		dungeonMasterSchema,
		v.object({
			name: v.optional(v.string(), "")
		})
	]),
	isDmLog: v.optional(v.boolean(), false),
	appliedDate: v.nullable(v.date()),
	magicItemsGained: v.optional(v.array(itemSchema), []),
	magicItemsLost: v.optional(v.array(itemIdSchema), []),
	storyAwardsGained: v.optional(v.array(itemSchema), []),
	storyAwardsLost: v.optional(v.array(itemIdSchema), [])
});

export const characterLogSchema = (character: CharacterData) =>
	v.object(logSchema.entries, [
		v.custom((input) => !input.isDmLog, "Only character logs can be saved here."),
		v.forward(
			v.custom((input) => {
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				return character.total_level < 20 || input.acp - logACP === 0;
			}, "Cannot increase level above 20"),
			["acp"]
		),
		v.forward(
			v.custom((input) => {
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				return character.total_level + input.level - logLevel <= 20;
			}, "Character cannot level past 20"),
			["level"]
		)
	]);

export const dMLogSchema = (characters: (CharacterData | { id: string; name: string })[]) =>
	v.object(logSchema.entries, [
		v.custom((input) => input.isDmLog, "Only DM logs can be saved here."),
		v.forward(
			v.custom((input) => !input.characterId || !!characters.find((c) => c.id === input.characterId), "Character not found"),
			["characterId"]
		),
		v.forward(
			v.custom((input) => !!input.characterId || !input.appliedDate, "Character must be selected if applied date is set"),
			["characterId"]
		),
		v.forward(
			v.custom((input) => !!input.appliedDate || !input.characterId, "Date must be set if applied to a character"),
			["appliedDate"]
		),
		v.forward(
			v.custom(
				(input) => !input.appliedDate || (input.appliedDate.getTime() - input.date.getTime()) / 1000 > -60,
				"Applied date must be after log date"
			),
			["appliedDate"]
		),
		v.forward(
			v.custom((input) => {
				const character = characters.find((c) => c.id === input.characterId);
				if (!character || !("logs" in character)) return true;
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				return character.total_level < 20 || input.acp - logACP === 0;
			}, "Cannot increase level above 20"),
			["acp"]
		),
		v.forward(
			v.custom((input) => {
				const character = characters.find((c) => c.id === input.characterId);
				if (!character || !("logs" in character)) return true;
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				return character.total_level + input.level - logLevel <= 20;
			}, "Cannot increase level above 20"),
			["level"]
		)
	]);
