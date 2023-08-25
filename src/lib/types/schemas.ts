import {
	array,
	boolean,
	coerce,
	date,
	literal,
	maxLength,
	merge,
	minLength,
	minValue,
	nullable,
	number,
	object,
	regex,
	string,
	union,
	url,
	type BaseSchema,
	type Input,
	type Output
} from "valibot";

export const dateSchema = coerce(date(), (input) => new Date(input as string | number | Date));

export type DungeonMasterSchema = Output<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = object({
	id: withDefault(string(), ""),
	name: withDefault(string(), "Me"),
	DCI: withDefault(nullable(string([regex(/[0-9]{0,10}/, "Invalid DCI Format")])), null),
	uid: withDefault(nullable(string()), "")
});

const itemSchema = (type: "Item" | "Story Award") =>
	object({
		id: withDefault(string(), ""),
		name: withDefault(string([minLength(1, `${type} Required`)]), ""),
		description: withDefault(string(), "")
	});

export type LogSchema = Output<typeof logSchema>;
export const logSchema = object({
	id: withDefault(string(), ""),
	name: withDefault(string([minLength(1, "Log Name Required")]), ""),
	date: dateSchema,
	characterId: withDefault(string(), ""),
	characterName: withDefault(string(), ""),
	type: withDefault(union([literal("game"), literal("nongame")]), "game"),
	experience: withDefault(number("Experience must be a number"), 0),
	acp: withDefault(number([minValue(0, "ACP must be a non-negative number")]), 0),
	tcp: withDefault(number("TCP must be a number"), 0),
	level: withDefault(number([minValue(0, "Level must be a non-negative number")]), 0),
	gold: withDefault(number("Gold must be a number"), 0),
	dtd: withDefault(number("Downtime days must be a number"), 0),
	description: withDefault(string(), ""),
	dm: dungeonMasterSchema,
	is_dm_log: withDefault(boolean(), false),
	applied_date: withDefault(nullable(dateSchema), null),
	magic_items_gained: array(itemSchema("Item")),
	magic_items_lost: array(string([minLength(1, "Invalid Item ID")])),
	story_awards_gained: array(itemSchema("Story Award")),
	story_awards_lost: array(string([minLength(1, "Invalid Story Award ID")]))
});

const optionalURL = withDefault(union([string([url("Invalid URL")]), string([maxLength(0)])], "Invalid URL"), "");

export type NewCharacterSchema = Output<typeof newCharacterSchema>;
export const newCharacterSchema = object({
	name: string([minLength(1, "Character Name Required")]),
	campaign: withDefault(string(), ""),
	race: withDefault(string(), ""),
	class: withDefault(string(), ""),
	character_sheet_url: optionalURL,
	image_url: optionalURL
});

export type EditCharacterSchema = Output<typeof editCharacterSchema>;
export const editCharacterSchema = merge([object({ id: string() }), newCharacterSchema]);

/**
 * Custom Validators
 */

export function withDefault<TSchema extends BaseSchema>(schema: TSchema, value: Input<TSchema>) {
	return coerce(schema, (input) =>
		typeof value === "string"
			? `${input || value}`.trim()
			: !input || (typeof value == "number" && isNaN(Number(input)))
			? value
			: input
	);
}

// const dateRegex = /^((\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|d{4}-((0[13578]|1[02])-(0[1-9]|[12]\d|3[01])|(0[469]|11)-(0[1-9]|[12]\d|30)|(02)-(0[1-9]|1\d|2[0-8])))T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}([+-]([01]\d|2[0-3]):[0-5]\d|Z)$/;

/**
 * Creates a complete, customizable validation function that validates a datetime.
 *
 * The correct number of days in a month is validated, including leap year.
 *
 * Date Format: yyyy-mm-dd
 * Time Formats: [T]hh:mm[:ss[.sss]][+/-hh:mm] or [T]hh:mm[:ss[.sss]][Z]
 *
 * @param {Object} options The configuration options.
 * @param {boolean} options.date Whether to validate the date.
 * @param {boolean} options.time Whether to validate the time.
 * @param {boolean} options.seconds Whether to validate the seconds.
 * @param {boolean} options.milliseconds Whether to validate the milliseconds.
 * @param {boolean} options.timezone Whether to validate the timezone.
 * @param {string} error The error message.
 *
 * @returns A validation function.
 */
export function iso<TInput extends string>(
	options?: {
		date?: boolean;
		time?: boolean;
		seconds?: boolean;
		milliseconds?: boolean;
		timezone?: boolean;
	},
	error?: string
) {
	return (input: TInput) => {
		// override default date and time options to true if options is undefined
		const {
			date = false,
			time = false,
			seconds = true,
			milliseconds = true,
			timezone = true
		} = options || { date: true, time: true };

		const dateRegex = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
		const secondsRegex = seconds ? `[0-5]\\d${milliseconds ? "\\.\\d{3}" : ""}` : "";
		const timezoneRegex = timezone ? "([+-]([01]\\d|2[0-3]):[0-5]\\d|Z)" : "";
		const timeRegex = `([01]\\d|2[0-3]):[0-5]\\d:${secondsRegex}${timezoneRegex}`;
		const regex = new RegExp(`^${date ? dateRegex : ""}${date && time ? "T" : time ? "T?" : ""}${time ? timeRegex : ""}$`);

		if (!regex.test(input)) {
			return {
				issue: {
					validation: "iso",
					message: error || "Invalid iso string",
					input
				}
			};
		}
		return input;
	};
}
