import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const path = resolve("e2e/.state/users.json");

export interface E2EState {
	userIds: string[];
}

export function readState(): E2EState {
	if (!existsSync(path)) return { userIds: [] };
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<E2EState>;
		const userIds = Array.isArray(parsed.userIds) ? parsed.userIds.filter((id): id is string => typeof id === "string") : [];
		return { userIds };
	} catch {
		return { userIds: [] };
	}
}

export function rememberUser(id: string) {
	const state = readState();
	if (!state.userIds.includes(id)) state.userIds.push(id);
	writeState(state);
}

export function resetState() {
	writeState({ userIds: [] });
}

function writeState(state: E2EState) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}
