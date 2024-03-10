import { q } from "$src/server/db";
import { json } from "@sveltejs/kit";

export async function GET() {
	return json(
		await q.characters.findFirst({
			orderBy: (characters, { asc }) => asc(characters.created_at)
		})
	);
}
