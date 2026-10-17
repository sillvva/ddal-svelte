import { guardedQuery } from "#lib/server/effect/guarded.js";
import { AuthService } from "#lib/server/effect/services/auth.js";

export const getAccounts = guardedQuery(function* () {
	const Auth = yield* AuthService;
	return yield* Auth.get.accounts();
});

export const onboarding = guardedQuery(function* () {
	return true;
}, "onboarding");
