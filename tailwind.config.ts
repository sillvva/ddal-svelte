import { icons as logos } from "@iconify-json/logos";
import { icons as mdi } from "@iconify-json/mdi";
import { getIconData } from "@iconify/utils";
import themes from "daisyui/src/theming/themes";
import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

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

		for (const [set, dataset] of Object.entries(iconSets)) {
			for (let [name, icon] of Object.entries(dataset.icons)) {
				if ((icon.height && !icon.width) || (icon.width && !icon.height)) icon = getIconData(dataset, name) || icon;
				const path = encodeURIComponent(icon.body);
				const width = icon.width || 24;
				const height = icon.height || 24;
				addUtilities({
					[`.${set}-${name}`]: {
						"--svg": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E${path}%3C/svg%3E")`
					}
				});
			}
		}
	});
};

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
		twIconifyPlugin({ mdi, logos })
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
