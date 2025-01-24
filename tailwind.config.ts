import { addIconSelectors } from "@iconify/tailwind";
import type { Config } from "tailwindcss";

export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	plugins: [addIconSelectors(["mdi", "material-symbols", "logos"])]
} satisfies Config;
