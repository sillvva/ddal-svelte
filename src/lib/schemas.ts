import type { CookieStore } from "$src/server/cookie";
import type { Account, Character } from "@prisma/client";
import {
	array,
	boolean,
	custom,
	date,
	forward,
	literal,
	maxLength,
	merge,
	minLength,
	minValue,
	nullable,
	nullish,
	number,
	object,
	optional,
	regex,
	string,
	undefined_,
	union,
	url,
	value,
	type Input,
	type Output,
	type Pipe
} from "valibot";

export const envSchema = (env: Record<string, string>) =>
	object({
		DATABASE_URL: string([url()]),
		REDIS_URL: string([regex(/^rediss?:\/\//, "Must be a valid Redis URL")]),
		AUTH_SECRET: string([minLength(10, "Must be a string of at least 10 characters")]),
		AUTH_URL: string([url()]),
		AUTH_TRUST_HOST: env["AUTH_URL"]?.includes("localhost")
			? string([value("true", "Required. Must be 'true'")])
			: undefined_("For localhost only"),
		GOOGLE_CLIENT_ID: string([minLength(1, "Required")]),
		GOOGLE_CLIENT_SECRET: string([minLength(1, "Required")]),
		DISCORD_CLIENT_ID: string([minLength(1, "Required")]),
		DISCORD_CLIENT_SECRET: string([minLength(1, "Required")]),
		CRON_CHARACTER_ID: string([minLength(1, "Required")])
	});

export type DungeonMasterSchema = Output<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = object({
	id: optional(string(), ""),
	name: optional(string(), "Me"),
	DCI: nullish(string([regex(/[0-9]{0,10}/, "Invalid DCI Format")])),
	uid: nullable(string()),
	owner: string()
});

const itemSchema = (type: "Item" | "Story Award") =>
	object({
		id: optional(string(), ""),
		name: optional(string([minLength(1, `${type} Name Required`)]), ""),
		description: optional(string(), "")
	});

const notNaN: Pipe<number> = [custom((input) => !isNaN(input))];

export type LogSchema = Output<typeof logSchema>;
export type LogSchemaIn = Input<typeof logSchema>;
export const logSchema = object({
	id: nullish(string(), ""),
	name: optional(string([minLength(1, "Log Name Required")]), ""),
	date: date("Invalid Date"),
	characterId: optional(string(), ""),
	characterName: optional(string(), ""),
	type: optional(union([literal("game"), literal("nongame")]), "game"),
	experience: optional(number("Experience must be a number", notNaN), 0),
	acp: optional(number([minValue(0, "ACP must be a non-negative number"), ...notNaN]), 0),
	tcp: optional(number("TCP must be a number", notNaN), 0),
	level: optional(number([minValue(0, "Level must be a non-negative number"), ...notNaN]), 0),
	gold: optional(number("Gold must be a number", notNaN), 0),
	dtd: optional(number("Downtime days must be a number", notNaN), 0),
	description: nullish(string(), ""),
	dm: dungeonMasterSchema,
	is_dm_log: optional(boolean(), false),
	applied_date: nullable(date("Invalid Date")),
	magic_items_gained: array(itemSchema("Item")),
	magic_items_lost: array(string([minLength(1, "Invalid Item ID")])),
	story_awards_gained: array(itemSchema("Story Award")),
	story_awards_lost: array(string([minLength(1, "Invalid Story Award ID")]))
});

export const dMLogSchema = (characters: Character[]) =>
	object(logSchema.entries, [
		custom((input) => input.is_dm_log, "Only DM logs can be saved here."),
		forward(
			custom(
				(input) => !(!!input.characterId && !(characters || []).find((c) => c.id === input.characterId)),
				"Character not found"
			),
			["characterId"]
		),
		forward(
			custom((input) => !(!input.applied_date && !!input.characterId), "Date must be set if applied to a character"),
			["applied_date"]
		),
		forward(
			custom((input) => !(!input.characterId && !!input.applied_date), "Character must be selected if applied date is set"),
			["characterId"]
		)
	]);

const optionalURL = optional(union([string([url("Invalid URL")]), string([maxLength(0)])], "Invalid URL"), "");

export type NewCharacterSchema = Output<typeof newCharacterSchema>;
export const newCharacterSchema = object({
	name: optional(string([minLength(1, "Character Name Required")]), ""),
	campaign: optional(string(), ""),
	race: optional(string(), ""),
	class: optional(string(), ""),
	character_sheet_url: optionalURL,
	image_url: optionalURL
});

export type EditCharacterSchema = Output<typeof editCharacterSchema>;
export const editCharacterSchema = merge([object({ id: string() }), newCharacterSchema]);

export type App = {
	settings: {
		background: boolean;
		theme: "system" | "dark" | "light";
		mode: "dark" | "light";
	};
	characters: {
		magicItems: boolean;
		display: "list" | "grid";
	};
	log: {
		descriptions: boolean;
	};
	dmLogs: {
		sort: "asc" | "desc";
	};
};
export type AppStore = CookieStore<App>;

type Provider = {
	name: string;
	id: string;
	logo?: string;
	account?: Account;
};
export const providers = [
	{
		name: "Google",
		id: "google",
		logo: "/images/google.svg"
	},
	{
		name: "Discord",
		id: "discord",
		logo: "/images/discord.svg"
	}
] as const satisfies Provider[];