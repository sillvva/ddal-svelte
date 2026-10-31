import assert from "node:assert/strict";
import { assertLocalE2E, E2EGuardError } from "./env.ts";

const local = {
	E2E_ALLOW_LOCAL: "1",
	PUBLIC_URL: "http://localhost:5173",
	DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
};

function rejects(env: Parameters<typeof assertLocalE2E>[0], pattern: RegExp) {
	assert.throws(
		() => assertLocalE2E(env),
		(error: unknown) => {
			assert.ok(error instanceof E2EGuardError);
			assert.match(error.message, pattern);
			return true;
		}
	);
}

rejects({}, /E2E_ALLOW_LOCAL/);
rejects({ ...local, E2E_ALLOW_LOCAL: "yes" }, /E2E_ALLOW_LOCAL/);
rejects({ ...local, PUBLIC_URL: "https://ddal.dekok.app" }, /not local/);
rejects({ ...local, PLAYWRIGHT_BASE_URL: "https://staging.example.com" }, /not local/);
rejects({ ...local, DATABASE_URL: "postgresql://postgres:postgres@db.example.supabase.co:5432/postgres" }, /DATABASE_URL/);
rejects(
	{
		...local,
		DATABASE_URL: "postgresql://postgres:postgres@db.example.supabase.co:5432/postgres",
		REMOTE_DB_URL: "postgresql://postgres:postgres@db.example.supabase.co:5432/postgres"
	},
	/DATABASE_URL|REMOTE_DB_URL/
);
rejects({ ...local, DATABASE_URL: undefined }, /DATABASE_URL/);

assert.doesNotThrow(() =>
	assertLocalE2E({
		...local,
		REMOTE_DB_URL: "postgresql://postgres:secret@db.example.supabase.co:5432/postgres"
	})
);
assert.doesNotThrow(() => assertLocalE2E({ ...local, E2E_ALLOW_LOCAL: "true" }));
assert.doesNotThrow(() =>
	assertLocalE2E({
		...local,
		PLAYWRIGHT_BASE_URL: "http://localhost:5173",
		DATABASE_URL: "postgresql://postgres:postgres@localhost:54322/postgres"
	})
);

console.log("e2e environment guard checks passed");
