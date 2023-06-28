import { serverSetCookie } from "$src/server/cookie";
import { json } from "@sveltejs/kit";

export async function POST({ request, cookies }) {
	const { name, value } = (await request.json()) as { name: string; value: string };

	const result = serverSetCookie(cookies, name, value);
	if (result !== null) return json({ result }, { status: 200 });
	else return json({ error: "Can't set cookie from client" }, { status: 400 });
}
