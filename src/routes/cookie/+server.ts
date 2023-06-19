import { serverSetCookie } from "$server/cookie";
import { json } from "@sveltejs/kit";

import type { RequestEvent } from "../$types";
export async function POST({ request, cookies }: RequestEvent) {
	const { name, value } = (await request.json()) as { name: string; value: string };

	const result = serverSetCookie(cookies, name, value);
	if (result !== null) return json({ result }, { status: 200 });
	else return json({ error: "Can't set cookie from client" }, { status: 400 });
}
