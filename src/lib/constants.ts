import type { Account } from "$server/db/schema";
import { publicEnv } from "./env/public";

export const BLANK_CHARACTER = `${publicEnv.PUBLIC_URL}/images/blank-character.webp` as const;

type Provider = {
	name: string;
	id: string;
	logo?: string;
	account?: Account;
};
export const PROVIDERS = [
	{
		name: "Google",
		id: "google",
		logo: "/images/google.svg"
	},
	{
		name: "Discord",
		id: "discord",
		logo: "/images/discord.svg"
	}
] as const satisfies Provider[];

export const stopWords = new Set(["and", "or", "to", "in", "a", "the", "of"]);

type Theme = {
	name: string;
	value: string;
	group?: "dark" | "light";
};

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
		name: "Corporate",
		value: "corporate",
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
		name: "Black",
		value: "black",
		group: "dark"
	},
	{
		name: "Business",
		value: "business",
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

export const themeGroups = ["dark", "light"] as const;
export type Themes = (typeof themes)[number]["value"];
export type ThemeGroups = (typeof themeGroups)[number];
