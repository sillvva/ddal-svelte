// ESLint flat config for SvelteKit + TypeScript + Prettier
// Migrated from .eslintrc.cjs to eslint.config.js (Flat Config)

import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import svelteConfig from "./svelte.config.js";

// Use the typescript-eslint aggregator for flat config presets
// (requires devDependency: "typescript-eslint")
import tseslint from "typescript-eslint";

export default [
	// Ignore generated and build artifacts
	{
		ignores: [
			// migrated from .eslintignore
			".DS_Store",
			"node_modules",
			"build",
			".svelte-kit",
			"package",
			".env",
			".env.*",
			"pnpm-lock.yaml",
			"package-lock.json",
			"yarn.lock",
			// additional
			"dist",
			".vite",
			"drizzle",
			"supabase/**/migrations/**"
		]
	},

	// Base language options and globals
	{
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: "module",
			globals: {
				...globals.browser,
				...globals.node,
				// Svelte built-in types
				$$Generic: "readonly",
				App: "readonly"
			}
		}
	},

	// Core JS recommended rules
	js.configs.recommended,

	// TypeScript rules (no type-aware rules by default)
	...tseslint.configs.recommended,

	// Svelte plugin recommended rules for Svelte files
	...svelte.configs["flat/recommended"],
	{
		files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
		languageOptions: {
			parserOptions: {
				// Ensure TS within <script lang="ts"> is parsed
				parser: tseslint.parser,
				projectService: true,
				extraFileExtensions: [".svelte"],
				// Pass through SvelteKit config for better rule behavior
				svelteConfig
			}
		}
	},
	// Turn off formatting-related Svelte rules to avoid conflicts with Prettier
	...svelte.configs["flat/prettier"],

	// Project-wide rule tweaks
	{
		rules: {
			"require-yield": "off",
			"svelte/no-navigation-without-resolve": "off"
		}
	},

	// Keep Prettier last to disable conflicting stylistic rules
	eslintConfigPrettier
];
