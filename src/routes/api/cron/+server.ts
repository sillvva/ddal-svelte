import { clearOldCaches } from "$src/server/cache";
import { prisma } from "$src/server/db";
import { json } from "@sveltejs/kit";

export async function GET() {
	clearOldCaches();
	return json(
		await prisma.character.findFirst({
			orderBy: {
				created_at: "desc"
			}
		})
	);
}
