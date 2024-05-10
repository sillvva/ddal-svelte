import { icons as logos } from "@iconify-json/logos";
import { icons as mdi } from "@iconify-json/mdi";
import { getIconData } from "@iconify/utils";
import themes from "daisyui/src/theming/themes";
import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { CSSRuleObject } from "tailwindcss/types/config";

type IconifyJSON = { icons: Record<string, { body: string; width?: number; height?: number }>; prefix: string };
const twIconifyPlugin = (iconSets: Record<string, IconifyJSON>) => {
	return plugin(function ({ addComponents, addUtilities, theme }) {
		addComponents({
			".iconify": {
				display: "inline-block",
				width: theme("width.4"),
				height: theme("height.4"),
				backgroundColor: theme("colors.current"),
				maskImage: "var(--svg)",
				maskRepeat: "no-repeat",
				maskSize: "100% 100%"
			}
		});

		addComponents({
			".iconify-color": {
				display: "inline-block",
				width: theme("width.4"),
				height: theme("height.4"),
				backgroundImage: "var(--svg)",
				backgroundRepeat: "no-repeat",
				backgroundSize: "100% 100%"
			}
		});

		const utilities: CSSRuleObject[] = [];
		for (const [set, dataset] of Object.entries(iconSets)) {
			for (let [name, icon] of Object.entries(dataset.icons)) {
				if ((icon.height && !icon.width) || (icon.width && !icon.height)) icon = getIconData(dataset, name) || icon;
				const path = encodeURIComponent(icon.body);
				const width = icon.width || 24;
				const height = icon.height || 24;
				utilities.push({
					[`.${set}-${name}`]: {
						"--svg": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E${path}%3C/svg%3E")`
					}
				});
			}
		}

		addUtilities(utilities);
	});
};

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
		twIconifyPlugin({ mdi, logos }),
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
			"business",
			"halloween",
			"night",
			"corporate",
			"retro",
			"valentine"
		]
	}
} satisfies Config;
