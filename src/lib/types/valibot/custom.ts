import { ValiError } from "valibot";

import type { BaseSchema, BaseSchemaAsync, Input, ValidateInfo } from "valibot";

export function withDefault<TSchema extends BaseSchema | BaseSchemaAsync>(schema: TSchema, value: Input<TSchema>) {
	return {
		...schema,
		parse(input: Input<TSchema>, info?: ValidateInfo) {
			if (value === "") return schema.parse(!input ? value : input.trim());
			return schema.parse(!input || (typeof value == "number" && isNaN(input)) ? value : input, info);
		}
	};
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
	return (input: TInput, info: ValidateInfo) => {
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
			throw new ValiError([
				{
					validation: "iso",
					origin: "value",
					message: error || "Invalid iso string",
					input,
					...info
				}
			]);
		}
		return input;
	};
}
