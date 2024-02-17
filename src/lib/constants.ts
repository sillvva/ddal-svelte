import { PUBLIC_PRODUCTION_URL } from "$env/static/public";
import type { Account } from "@prisma/client";

export const BLANK_CHARACTER = `${PUBLIC_PRODUCTION_URL}/images/blank-character.webp` as const;

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
