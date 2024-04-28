import { icons as mdi } from "@iconify-json/mdi";
import themes from "daisyui/src/theming/themes";
import postcss from "postcss";
import plugin from "tailwindcss/plugin";

/** @type {import('tailwindcss').Config} */
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
		plugin(function ({ addVariant, e }) {
			addVariant("hover-hover", ({ container, separator }) => {
				const hover = postcss.atRule({ name: "media", params: "(hover: hover)" });
				hover.append(container.nodes);
				container.append(hover);
				hover.walkRules((rule) => {
					rule.selector = `.${e(`hover-hover${separator}${rule.selector.slice(1)}`)}`;
				});
			});
			addVariant("hover-none", ({ container, separator }) => {
				const hoverNone = postcss.atRule({ name: "media", params: "(hover: none)" });
				hoverNone.append(container.nodes);
				container.append(hoverNone);
				hoverNone.walkRules((rule) => {
					rule.selector = `.${e(`hover-none${separator}${rule.selector.slice(1)}`)}`;
				});
			});
		}),
		plugin(function ({ addComponents, addUtilities, theme }) {
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

			const iconSets = {
				mdi: mdi.icons
			};
			for (const [set, icons] of Object.entries(iconSets)) {
				for (const [name, icon] of Object.entries(icons)) {
					const path = encodeURIComponent(icon.body).replace(/%20/g, " ").replace(/%22/g, "'");
					const width = icon.width || 24;
					const height = icon.height || 24;
					addUtilities({
						[`.${set}-${name}`]: {
							"--svg": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E${path}%3C/svg%3E")`
						}
					});
				}
			}
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
};
