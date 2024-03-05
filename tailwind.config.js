// eslint-disable-next-line @typescript-eslint/no-var-requires
import { addDynamicIconSelectors } from "@iconify/tailwind";
import themes from "daisyui/src/theming/themes";
import postcss from "postcss";

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
		addDynamicIconSelectors(),
		function ({ addVariant, e }) {
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
		}
	],
	daisyui: {
		// darkTheme: "black",
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
					secondary: "#c881ff"
				}
			},
			{
				dark: {
					...themes["dark"],
					primary: "#6419e6",
					secondary: "#c881ff",
					"base-content": "#c4ccca"
				}
			}
		]
	}
};
