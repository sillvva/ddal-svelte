const REMOTE_FRAME = /[/\\]src[/\\]lib[/\\]remote[/\\](.+?)\.remote\.ts(?:\?[^:]+)?:(\d+):\d+/;

export type RemoteSource = {
	/** Module id such as `auth.queries`, taken from `src/lib/remote/<id>.remote.ts`. */
	id: string;
	line: number;
};

export function remoteSourceFromStack(stack: string | undefined): RemoteSource | undefined {
	const match = stack?.match(REMOTE_FRAME);
	const file = match?.[1];
	const line = match?.[2];
	if (!file || !line) return;

	return {
		id: file.replaceAll("\\", "/").replaceAll("/", "."),
		line: Number(line)
	};
}

/** Caller of `guardedQuery` / `run` when that caller is a `*.remote.ts` module. */
export function captureRemoteSource(): RemoteSource | undefined {
	return remoteSourceFromStack(new Error().stack);
}

function remoteExportName(fn: unknown): string | undefined {
	if ((typeof fn !== "object" && typeof fn !== "function") || fn === null || !("__" in fn)) return;

	const internals = fn.__;
	if (typeof internals !== "object" || internals === null || !("name" in internals)) return;

	const name = internals.name;
	return typeof name === "string" && name.length > 0 ? name : undefined;
}

/**
 * `auth.queries.getAccounts` when SvelteKit has assigned the export name.
 * Falls back to `auth.queries:12` for a direct `run()` call in a remote module.
 */
export function remoteLabel(fn: unknown, source: RemoteSource | undefined): string | undefined {
	const name = remoteExportName(fn);
	if (source && name) return `${source.id}.${name}`;
	if (name) return name;
	if (source) return `${source.id}:${source.line}`;
	return undefined;
}
