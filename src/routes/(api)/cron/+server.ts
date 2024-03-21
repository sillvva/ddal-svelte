import { q } from "$server/db";
import { json } from "@sveltejs/kit";

export async function GET() {
	return json(
		await q.characters.findFirst({
			orderBy: (characters, { asc }) => asc(characters.createdAt)
		})
	);
}
