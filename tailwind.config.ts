import { addIconSelectors } from "@iconify/tailwind";
import themes from "daisyui/src/theming/themes";
import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const buildMemberSelector = (modifier) => `.member${modifier ? `\\/${modifier}` : ""}`;

export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	darkMode: ["class"],
	theme: {
		extend: {
			fontFamily: {
				draconis: ["Draconis"],
				vecna: ["Vecna"]
			}
		},
		screens: {
			xs: "500px",
			sm: "640px",
			md: "768px",
			lg: "1024px",
			xl: "1280px",
			"2xl": "1440px"
		}
	},
	plugins: [
		require("daisyui"),
		plugin(function ({ addVariant }) {
			addVariant("hover-hover", "@media (hover: hover)");
			addVariant("hover-none", "@media (hover: none)");
		}),
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
	],
	daisyui: {
		themes: [
			{
				light: {
					...themes["light"],
					primary: "#1b5be4",
					secondary: "#2F63FF",
					accent: "#6b6b6b"
				}
			},
			{
				black: {
					...themes["black"],
					primary: "#6419e6",
					secondary: "#c881ff",
					error: "#b91c1c",
					"error-content": "white"
				}
			},
			{
				dark: {
					...themes["dark"],
					primary: "#6419e6",
					secondary: "#c881ff",
					"base-content": "#c4ccca"
				}
			},
			{
				business: {
					...themes["business"],
					secondary: "oklch(71.7036% 0.099057 220.473931)"
				}
			},
			{
				halloween: {
					...themes["halloween"],
					secondary: "#c881ff",
					error: "#d04000",
					"error-content": "white"
				}
			},
			"night",
			{
				corporate: {
					...themes["corporate"],
					secondary: "oklch(50.39% 0.228 220.1)"
				}
			},
			{
				retro: {
					...themes["retro"],
					secondary: "oklch(50.8664% 0.104092 60.664655)"
				}
			},
			{
				valentine: {
					...themes["valentine"],
					secondary: "#6419e6"
				}
			}
		]
	}
} satisfies Config;
