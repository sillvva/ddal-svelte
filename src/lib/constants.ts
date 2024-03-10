import type { Account } from "$src/db/schema";
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
