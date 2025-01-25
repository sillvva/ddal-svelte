import { addIconSelectors } from "@iconify/tailwind";
import type { Config } from "tailwindcss";

export default {
	plugins: [addIconSelectors(["mdi", "material-symbols", "logos"])]
} satisfies Config;
