import { addIconSelectors } from "@iconify/tailwind";
import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const buildMemberSelector = (modifier) => `.member${modifier ? `\\/${modifier}` : ""}`;

export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	plugins: [
		// require("daisyui"),
		addIconSelectors(["mdi", "material-symbols", "logos"]),
		plugin(({ matchVariant }) => {
			const values = {
				// Default
				DEFAULT: "&",

				// Positional
				first: "&:first-child",
				last: "&:last-child",
				only: "&:only-child",
				odd: "&:nth-child(odd)",
				even: "&:nth-child(even)",
				"first-of-type": "&:first-of-type",
				"last-of-type": "&:last-of-type",
				"only-of-type": "&:only-of-type",

				// State
				visited: "&:visited",

				target: "&:target",
				open: "&:is([open], :popover-open)",

				// Forms
				default: "&:default",
				checked: "&:checked",
				indeterminate: "&:indeterminate",
				"placeholder-shown": "&:placeholder-shown",
				autofill: "&:autofill",
				optional: "&:optional",
				required: "&:required",
				valid: "&:valid",
				invalid: "&:invalid",
				"in-range": "&:in-range",
				"out-of-range": "&:out-of-range",
				"read-only": "&:read-only",

				// Content
				empty: "&:empty",

				// Interactive
				"focus-within": "&:focus-within",
				hover: "&:hover",
				focus: "&:focus",
				"focus-visible": "&:focus-visible",
				active: "&:active",
				enabled: "&:enabled",
				disabled: "&:disabled"
			};

			matchVariant(
				"member",
				(rawValue, { modifier }) => {
					const value = rawValue || "&";
					const selector = buildMemberSelector(modifier);
					return `&:has(${selector}:is(${value.replace(/&/g, "*")})) { & }`;
				},
				{
					values
				}
			);

			matchVariant(
				"member-not",
				(rawValue, { modifier }) => {
					const value = rawValue || "&";
					const selector = buildMemberSelector(modifier);
					return `&:has(${selector}:not(${value.replace(/&/g, "*")})) { & }`;
				},
				{
					values
				}
			);
		})
	]
} satisfies Config;
