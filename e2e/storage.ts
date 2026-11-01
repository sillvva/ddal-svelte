import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const UUID = "[0-9a-f-]{36}";
const FILE = "[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}\\.(webp|jpg)";
const SHAPES = `users/${UUID}/characters/${UUID}/${FILE}|users/${UUID}/avatar/${FILE}|users/${UUID}/notes/${FILE}`;
const PERMANENT = new RegExp(`^(${SHAPES})$`, "iu");
const TEMPORARY = new RegExp(`^tmp/(${SHAPES})$`, "iu");

let client: S3Client | null = null;

function bucket() {
	const name = process.env.R2_BUCKET;
	if (!name) throw new Error("R2_BUCKET is not set");
	return name;
}

function s3() {
	if (client) return client;
	const endpoint = process.env.R2_ENDPOINT;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
	if (!endpoint || !accessKeyId || !secretAccessKey) {
		throw new Error("R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required to check stored images");
	}
	client = new S3Client({
		region: "auto",
		endpoint: endpoint.replace(/\/+$/, ""),
		credentials: { accessKeyId, secretAccessKey },
		requestChecksumCalculation: "WHEN_REQUIRED",
		responseChecksumValidation: "WHEN_REQUIRED"
	});
	return client;
}

export function isAppImageKey(key: string) {
	return PERMANENT.test(key) || TEMPORARY.test(key);
}

export function userIdFromImageKey(key: string) {
	const permanent = key.startsWith("tmp/") ? key.slice("tmp/".length) : key;
	if (!PERMANENT.test(permanent)) return null;
	return permanent.split("/")[1] ?? null;
}

export function userImagePrefixes(userId: string) {
	return [`users/${userId}/`, `tmp/users/${userId}/`];
}

export function keyFromPublicUrl(imageUrl: string) {
	const publicBase = process.env.R2_PUBLIC_URL;
	if (!publicBase) throw new Error("R2_PUBLIC_URL is not set");
	let url: URL;
	let base: URL;
	try {
		url = new URL(imageUrl);
		base = new URL(publicBase);
	} catch {
		return null;
	}
	if (url.origin !== base.origin) return null;
	const prefix = base.pathname.replace(/\/$/, "");
	let path: string;
	try {
		path = decodeURIComponent(url.pathname);
	} catch {
		return null;
	}
	if (prefix && path !== prefix && !path.startsWith(`${prefix}/`)) return null;
	const key = path.slice(prefix.length).replace(/^\//, "");
	if (!key || key.includes("..") || key.includes("\\") || key.includes("//")) return null;
	return key;
}

export async function listPrefix(prefix: string) {
	const keys: string[] = [];
	let token: string | undefined;
	do {
		const page = await s3().send(
			new ListObjectsV2Command({
				Bucket: bucket(),
				Prefix: prefix,
				ContinuationToken: token
			})
		);
		for (const object of page.Contents ?? []) {
			if (object.Key) keys.push(object.Key);
		}
		token = page.IsTruncated ? page.NextContinuationToken : undefined;
	} while (token);
	return keys;
}

export async function listUserObjects(userId: string) {
	const keys = new Set<string>();
	for (const prefix of userImagePrefixes(userId)) {
		for (const key of await listPrefix(prefix)) {
			if (key.startsWith(prefix) && isAppImageKey(key) && userIdFromImageKey(key) === userId) keys.add(key);
		}
	}
	return [...keys];
}

export async function objectExists(key: string) {
	try {
		await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
		return true;
	} catch (cause) {
		if (isMissing(cause)) return false;
		throw cause;
	}
}

export async function deleteObject(key: string) {
	if (!isAppImageKey(key)) throw new Error(`Refusing to delete an object outside image storage: ${key}`);
	try {
		await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
		return true;
	} catch (cause) {
		if (isMissing(cause)) return false;
		throw cause;
	}
}

export async function waitUntilMissing(key: string, timeoutMs = 20_000) {
	const started = Date.now();
	for (;;) {
		if (!(await objectExists(key))) return;
		if (Date.now() - started > timeoutMs) throw new Error(`Stored image was not deleted: ${key}`);
		await new Promise((resolve) => setTimeout(resolve, 400));
	}
}

function isMissing(cause: unknown) {
	if (typeof cause !== "object" || cause === null) return false;
	if ("name" in cause && (cause.name === "NotFound" || cause.name === "NoSuchKey")) return true;
	if (
		"$metadata" in cause &&
		typeof cause.$metadata === "object" &&
		cause.$metadata !== null &&
		"httpStatusCode" in cause.$metadata
	) {
		return cause.$metadata.httpStatusCode === 404;
	}
	return false;
}
