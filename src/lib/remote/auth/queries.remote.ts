import { guardedQuery } from "#lib/server/effect/guarded.js";
import { AuthService } from "#lib/server/effect/services/auth.js";

export const getAccounts = guardedQuery(function* ({ user }) {
	const Auth = yield* AuthService;
	return yield* Auth.getAccounts();
});
