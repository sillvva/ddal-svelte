import type { Account } from "$server/db/schema";

export const searchSections = [
	{ title: "Characters", url: "/characters" },
	{ title: "DM Logs", url: "/dm-logs" },
	{ title: "DMs", url: "/dms" }
] as const;

export const BLANK_CHARACTER = `/images/blank-character.jpg` as const;

type Provider = {
	name: string;
	id: string;
	iconify?: string;
	account?: Account;
};
export type ProviderId = (typeof PROVIDERS)[number]["id"];
export const PROVIDERS = [
	{
		name: "Google",
		id: "google",
		iconify: "logos--google-icon"
	},
	{
		name: "Discord",
		id: "discord",
		iconify: "logos--discord-icon"
	}
] as const satisfies Provider[];

export const PlaceholderName = "Placeholder";

type Theme = {
	name: string;
	value: string;
	group?: (typeof themeGroups)[number];
};
export const themeGroups = ["dark", "light"] as const;
export const themes = [
	{
		name: "System",
		value: "system"
	},
	{
		name: "Light",
		value: "light",
		group: "light"
	},
	{
		name: "Retro",
		value: "retro",
		group: "light"
	},
	{
		name: "Valentine",
		value: "valentine",
		group: "light"
	},
	{
		name: "Garden",
		value: "garden",
		group: "light"
	},
	{
		name: "Dark",
		value: "dark",
		group: "dark"
	},
	{
		name: "Black",
		value: "black",
		group: "dark"
	},
	{
		name: "Halloween",
		value: "halloween",
		group: "dark"
	},
	{
		name: "Night",
		value: "night",
		group: "dark"
	}
] as const satisfies Theme[];

export type Themes = (typeof themes)[number]["value"];
export type ThemeGroups = (typeof themeGroups)[number];
