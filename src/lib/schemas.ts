import type { CharacterData } from "$server/data/characters";
// prettier-ignore
import { array, boolean, custom, date, fallback, forward, integer, literal, merge, minLength, minValue, null_, nullable, number, object, optional, regex, string, union, url, type Input, type Output } from "valibot";

export const envPrivateSchema = object({
	DATABASE_URL: string([url()]),
	UPSTASH_REDIS_REST_URL: string([url()]),
	UPSTASH_REDIS_REST_TOKEN: string([minLength(1)]),
	AUTH_SECRET: string([minLength(10, "Must be a string of at least 10 characters")]),
	AUTH_URL: string([url()]),
	GOOGLE_CLIENT_ID: string([minLength(1, "Required")]),
	GOOGLE_CLIENT_SECRET: string([minLength(1, "Required")]),
	DISCORD_CLIENT_ID: string([minLength(1, "Required")]),
	DISCORD_CLIENT_SECRET: string([minLength(1, "Required")]),
	CRON_CHARACTER_ID: string([minLength(1, "Required")]),
	DISABLE_SIGNUPS: optional(boolean(), false)
});

export const envPublicSchema = object({
	PUBLIC_URL: string([url()])
});

export type DungeonMasterSchema = Output<typeof dungeonMasterSchema>;
export type DungeonMasterSchemaIn = Input<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = object({
	id: string(),
	name: string([minLength(1)]),
	DCI: nullable(union([string([regex(/[0-9]{0,10}/, "Invalid DCI Format")]), null_()]), null),
	uid: nullable(union([string(), null_()]), ""),
	owner: string([minLength(1, "DM is not assigned to a user")])
});

const itemSchema = object({
	id: optional(string(), ""),
	name: string([minLength(1)]),
	description: optional(string(), "")
});

export type LogSchema = Output<typeof logSchema>;
export type LogSchemaIn = Input<typeof logSchema>;
export const logSchema = object({
	id: optional(string(), ""),
	name: string([minLength(1)]),
	date: date(),
	characterId: optional(string(), ""),
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
	magicItemsLost: optional(array(string([minLength(1)])), []),
	storyAwardsGained: optional(array(itemSchema), []),
	storyAwardsLost: optional(array(string([minLength(1)])), [])
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

const optionalURL = optional(fallback(string([url()]), ""), "");

export type NewCharacterSchema = Output<typeof newCharacterSchema>;
export const newCharacterSchema = object({
	name: string([minLength(1)]),
	campaign: optional(string(), ""),
	race: optional(string(), ""),
	class: optional(string(), ""),
	characterSheetUrl: optionalURL,
	imageUrl: optionalURL
});

export type EditCharacterSchema = Output<typeof editCharacterSchema>;
export const editCharacterSchema = merge([object({ id: string() }), newCharacterSchema]);
