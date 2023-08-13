import { defineConfig } from "vite";
import { typeschemaPlugin } from "@decs/typeschema/vite";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
	plugins: [sveltekit(), typeschemaPlugin()]
});
