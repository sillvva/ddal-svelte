import { guardedQuery } from "$lib/server/effect/remote";
import { AuthService } from "$lib/server/effect/services/auth";

export const getAccounts = guardedQuery(function* ({ user }) {
	const Auth = yield* AuthService;
	return yield* Auth.getAccounts();
});
