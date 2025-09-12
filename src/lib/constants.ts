import type { Pathname } from "$app/types";
import type { Account } from "$lib/server/db/schema";

export const defaultTitle = "Adventurers League Log Sheet";
export const defaultDescription = "A tool for tracking your Adventurers League characters and magic items.";
export const defaultImage = "https://ddal.dekok.app/images/barovia-gate.webp";

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
		name: "Monolight",
		value: "monolight",
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
		name: "Monodark",
		value: "monodark",
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

export type FullPathname = Pathname | `${Pathname}?${string}`;
