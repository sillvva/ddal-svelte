import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/server/kv/schema.ts",
	out: "./drizzle/kv",
	driver: "better-sqlite",
	dbCredentials: {
		url: "./kv.db"
	},
	verbose: true,
	strict: false
});
