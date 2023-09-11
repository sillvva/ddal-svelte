import {
	array,
	boolean,
	custom,
	date,
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
	transform,
	union,
	url,
	type Input,
	type Output,
	type Pipe,
	type PipeResult
} from "valibot";

export const dateSchema = transform(
	union([date(), string([iso()]), number([minValue(0)])], "Must be a valid date/time"),
	(input) => new Date(input)
);

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
	date: dateSchema,
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
	applied_date: nullable(dateSchema),
	magic_items_gained: array(itemSchema("Item")),
	magic_items_lost: array(string([minLength(1, "Invalid Item ID")])),
	story_awards_gained: array(itemSchema("Story Award")),
	story_awards_lost: array(string([minLength(1, "Invalid Story Award ID")]))
});

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

/**
 * Custom Validators
 */

// const dateRegex = /^((\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|d{4}-((0[13578]|1[02])-(0[1-9]|[12]\d|3[01])|(0[469]|11)-(0[1-9]|[12]\d|30)|(02)-(0[1-9]|1\d|2[0-8])))T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}([+-]([01]\d|2[0-3]):[0-5]\d|Z)$/;

/**
 * Creates a complete, customizable validation function that validates a datetime.
 * The correct number of days in a month is validated, including leap year.
 *
 * Date Format: yyyy-mm-dd
 *
 * Time Formats: [T]hh:mm[:ss[.sss]][Z|+/-hh:mm]
 *
 * @param {Object} options The configuration options.
 * @param {boolean} options.date Whether to validate the date.
 * @param {boolean} options.time Whether to validate the time.
 * @param {boolean | "optional"} options.seconds Whether to validate the seconds.
 * @param {boolean | "optional"} options.milliseconds Whether to validate the milliseconds.
 * @param {boolean | "optional"} options.timezone Whether to validate the timezone.
 * @param {string} error The error message.
 *
 * @returns A validation function.
 */
export function iso<TInput extends string>(options?: {
	date?: boolean;
	time?: boolean;
	seconds?: boolean | "optional";
	milliseconds?: boolean | "optional";
	timezone?: boolean | "optional";
	error?: string;
}) {
	return (input: TInput): PipeResult<TInput> => {
		const {
			date = true,
			time = true,
			seconds = "optional",
			milliseconds = "optional",
			timezone = "optional",
			error = "Invalid ISO string"
		} = options || {};

		const dateRegex = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
		const millisecondsRegex = milliseconds ? `(\\.\\d{3})${milliseconds === "optional" ? "?" : ""}` : "";
		const secondsRegex = seconds ? `(:[0-5]\\d${millisecondsRegex})${seconds === "optional" ? "?" : ""}` : "";
		const timezoneRegex = timezone ? `([+-]([01]\\d|2[0-3]):[0-5]\\d|Z)${timezone === "optional" ? "?" : ""}` : "";
		const timeRegex = `([01]\\d|2[0-3]):[0-5]\\d${secondsRegex}${timezoneRegex}`;
		const regex = new RegExp(`^${date ? dateRegex : ""}${date && time ? "T" : time ? "T?" : ""}${time ? timeRegex : ""}$`);

		if (!regex.test(input)) {
			return {
				issue: {
					validation: "iso",
					message: error,
					input
				}
			};
		}
		return { output: input };
	};
}
