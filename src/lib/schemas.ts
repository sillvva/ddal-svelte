import type { CharacterData } from "$server/data/characters";
// prettier-ignore
import { array, boolean, custom, date, fallback, forward, integer, literal, merge, minLength, minValue, null_, nullable, number, object, optional, regex, string, transform, union, url, type BaseSchema, type Input, type Output } from "valibot";
import type { Branded } from "./util";

const brand = <T extends string, TInput = unknown>(schema: BaseSchema<TInput>, name: T) =>
	transform(schema, (input) => input as Branded<TInput, typeof name>);

function brandedId<T extends string>(name: T) {
	return brand(string([required]), name);
}

const required = minLength<string, 1>(1, "Required");

export const envPrivateSchema = object({
	DATABASE_URL: string([url()]),
	UPSTASH_REDIS_REST_URL: string([url()]),
	UPSTASH_REDIS_REST_TOKEN: string([required]),
	AUTH_SECRET: string([minLength(10, "Must be a string of at least 10 characters")]),
	AUTH_URL: string([url()]),
	GOOGLE_CLIENT_ID: string([required]),
	GOOGLE_CLIENT_SECRET: string([required]),
	DISCORD_CLIENT_ID: string([required]),
	DISCORD_CLIENT_SECRET: string([required]),
	CRON_CHARACTER_ID: string([required]),
	DISABLE_SIGNUPS: optional(boolean(), false)
});

export const envPublicSchema = object({
	PUBLIC_URL: string([url()])
});

export type UserId = Output<typeof userIdSchema>;
export const userIdSchema = brandedId("UserId");

const optionalURL = optional(fallback(string([url()]), ""), "");

export type NewCharacterSchema = Output<typeof newCharacterSchema>;
export const newCharacterSchema = object({
	name: string([required]),
	campaign: optional(string(), ""),
	race: optional(string(), ""),
	class: optional(string(), ""),
	characterSheetUrl: optionalURL,
	imageUrl: optionalURL
});

export type CharacterId = Output<typeof characterIdSchema>;
export const characterIdSchema = brandedId("CharacterId");

export type EditCharacterSchema = Output<typeof editCharacterSchema>;
export const editCharacterSchema = merge([object({ id: characterIdSchema }), newCharacterSchema]);

export type DungeonMasterId = Output<typeof dungeonMasterIdSchema>;
export const dungeonMasterIdSchema = brandedId("DungeonMasterId");

export type DungeonMasterSchema = Output<typeof dungeonMasterSchema>;
export type DungeonMasterSchemaIn = Input<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = object({
	id: dungeonMasterIdSchema,
	name: string([required]),
	DCI: nullable(union([string([regex(/[0-9]{0,10}/, "Invalid DCI Format")]), null_()]), null),
	uid: nullable(union([userIdSchema, null_()]), ""),
	owner: userIdSchema
});

export type ItemId = Output<typeof itemIdSchema>;
export const itemIdSchema = brandedId("ItemID");

const itemSchema = object({
	id: optional(itemIdSchema, ""),
	name: string([required]),
	description: optional(string(), "")
});

export type LogId = Output<typeof logIdSchema>;
export const logIdSchema = brandedId("LogId");

export type LogSchema = Output<typeof logSchema>;
export type LogSchemaIn = Input<typeof logSchema>;
export const logSchema = object({
	id: optional(logIdSchema, ""),
	name: string([required]),
	date: date(),
	characterId: optional(characterIdSchema, ""),
	characterName: optional(string(), ""),
	type: optional(union([literal("game"), literal("nongame")]), "game"),
	experience: number([integer(), minValue(0)]),
	acp: number([integer(), minValue(0)]),
	tcp: number([integer()]),
	level: number([integer(), minValue(0)]),
	gold: number(),
	dtd: number([integer()]),
	description: optional(union([string(), null_()]), ""),
	dm: merge([
		dungeonMasterSchema,
		object({
			name: optional(string(), "")
		})
	]),
	isDmLog: optional(boolean(), false),
	appliedDate: nullable(date()),
	magicItemsGained: optional(array(itemSchema), []),
	magicItemsLost: optional(array(itemIdSchema), []),
	storyAwardsGained: optional(array(itemSchema), []),
	storyAwardsLost: optional(array(itemIdSchema), [])
});

export const characterLogSchema = (character: CharacterData) =>
	object(logSchema.entries, [
		custom((input) => !input.isDmLog, "Only character logs can be saved here."),
		forward(
			custom((input) => {
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				return character.total_level < 20 || input.acp - logACP === 0;
			}, "Cannot increase level above 20"),
			["acp"]
		),
		forward(
			custom((input) => {
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				return character.total_level + input.level - logLevel <= 20;
			}, "Character cannot level past 20"),
			["level"]
		)
	]);

export const dMLogSchema = (characters: (CharacterData | { id: string; name: string })[]) =>
	object(logSchema.entries, [
		custom((input) => input.isDmLog, "Only DM logs can be saved here."),
		forward(
			custom((input) => !input.characterId || !!characters.find((c) => c.id === input.characterId), "Character not found"),
			["characterId"]
		),
		forward(
			custom((input) => !!input.characterId || !input.appliedDate, "Character must be selected if applied date is set"),
			["characterId"]
		),
		forward(
			custom((input) => !!input.appliedDate || !input.characterId, "Date must be set if applied to a character"),
			["appliedDate"]
		),
		forward(
			custom(
				(input) => !input.appliedDate || (input.appliedDate.getTime() - input.date.getTime()) / 1000 > -60,
				"Applied date must be after log date"
			),
			["appliedDate"]
		),
		forward(
			custom((input) => {
				const character = characters.find((c) => c.id === input.characterId);
				if (!character || !("logs" in character)) return true;
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				return character.total_level < 20 || input.acp - logACP === 0;
			}, "Cannot increase level above 20"),
			["acp"]
		),
		forward(
			custom((input) => {
				const character = characters.find((c) => c.id === input.characterId);
				if (!character || !("logs" in character)) return true;
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				return character.total_level + input.level - logLevel <= 20;
			}, "Cannot increase level above 20"),
			["level"]
		)
	]);
