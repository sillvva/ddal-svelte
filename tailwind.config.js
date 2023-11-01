// eslint-disable-next-line @typescript-eslint/no-var-requires
const themes = require("daisyui/src/theming/themes");

/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	darkMode: ['[data-mode="dark"]'],
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
	plugins: [require("daisyui")],
	daisyui: {
		themes: [
			{
				light: {
					...themes["[data-theme=light]"],
					primary: "#1b5be4",
					secondary: "#2F63FF",
					accent: "#6b6b6b"
				},
				dark: {
					...themes["[data-theme=dark]"],
					secondary: "#c881ff"
				}
			}
		]
	}
};
