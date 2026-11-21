// Empties the dev R2 bucket. `pnpm op:db:local:reset` runs it after a successful local reseed, so objects
// uploaded to the old local database do not outlive their rows.
//
// Run with Node's type stripping, under `op run` so the R2_* variables are set:
//   pnpm op:r2:clean:dev
//
// Safety: it only ever empties the bucket named by R2_DEV_BUCKET (default `ddal-uploads-dev`), and refuses
// to touch the production bucket `ddal-uploads` under any configuration.
//
// Skips with exit 0 when SKIP_R2_CLEAN=1, or when R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, or
// R2_SECRET_ACCESS_KEY is missing (CI has no secrets). Exits 1 on a refusal or an error. Never prints secrets.
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

export const PRODUCTION_BUCKET = "ddal-uploads";
export const DEFAULT_DEV_BUCKET = "ddal-uploads-dev";
/** `DeleteObjects` accepts at most 1000 keys per request. */
export const DELETE_BATCH_SIZE = 1000;

export type CleanEnv = Record<string, string | undefined>;

export type CleanPlan =
	| { action: "skip"; reason: string }
	| { action: "refuse"; reason: string }
	| { action: "clean"; bucket: string; endpoint: string; accessKeyId: string; secretAccessKey: string };

const REQUIRED = ["R2_BUCKET", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;

/** Decides whether to clean, skip, or refuse. Pure: reads only `env`. */
export function planClean(env: CleanEnv): CleanPlan {
	const skip = env.SKIP_R2_CLEAN?.trim().toLowerCase();
	if (skip === "1" || skip === "true") return { action: "skip", reason: "SKIP_R2_CLEAN is set." };

	const missing = REQUIRED.filter((name) => !env[name]);
	if (missing.length) return { action: "skip", reason: `R2 credentials are not available (missing ${missing.join(", ")}).` };

	const bucket = env.R2_BUCKET ?? "";
	const endpoint = env.R2_ENDPOINT ?? "";
	const accessKeyId = env.R2_ACCESS_KEY_ID ?? "";
	const secretAccessKey = env.R2_SECRET_ACCESS_KEY ?? "";
	const expected = env.R2_DEV_BUCKET || DEFAULT_DEV_BUCKET;

	if (expected === PRODUCTION_BUCKET) {
		return { action: "refuse", reason: `R2_DEV_BUCKET must not be the production bucket "${PRODUCTION_BUCKET}".` };
	}
	if (bucket === PRODUCTION_BUCKET) {
		return { action: "refuse", reason: `R2_BUCKET is the production bucket "${PRODUCTION_BUCKET}".` };
	}
	if (bucket !== expected) {
		return {
			action: "refuse",
			reason: `R2_BUCKET is "${bucket}", not the dev bucket "${expected}". Set R2_DEV_BUCKET to override the expected name.`
		};
	}
	return { action: "clean", bucket, endpoint, accessKeyId, secretAccessKey };
}

export function chunk<T>(items: readonly T[], size: number) {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
	return chunks;
}

export interface BucketOps {
	list: (bucket: string, token?: string) => Promise<{ keys: string[]; next?: string }>;
	/** Deletes up to {@link DELETE_BATCH_SIZE} keys. Returns how many were deleted and a message per failed key. */
	remove: (bucket: string, keys: string[]) => Promise<{ deleted: number; errors: string[] }>;
}

/** Lists the whole bucket page by page and deletes each page in batches. Returns the number of deleted objects. */
export async function emptyBucket(ops: BucketOps, bucket: string) {
	let deleted = 0;
	let token: string | undefined;
	do {
		const page = await ops.list(bucket, token);
		for (const batch of chunk(page.keys, DELETE_BATCH_SIZE)) {
			const result = await ops.remove(bucket, batch);
			deleted += result.deleted;
			if (result.errors.length) {
				throw new Error(
					`Could not delete ${result.errors.length} object(s) (${deleted} deleted so far). First error: ${result.errors[0]}`
				);
			}
		}
		token = page.next;
	} while (token);
	return deleted;
}

function s3Ops(plan: Extract<CleanPlan, { action: "clean" }>): BucketOps {
	const client = new S3Client({
		region: "auto",
		endpoint: plan.endpoint.replace(/\/+$/, ""),
		credentials: { accessKeyId: plan.accessKeyId, secretAccessKey: plan.secretAccessKey },
		requestChecksumCalculation: "WHEN_REQUIRED",
		responseChecksumValidation: "WHEN_REQUIRED"
	});
	return {
		async list(bucket, token) {
			const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
			const keys: string[] = [];
			for (const object of page.Contents ?? []) {
				if (object.Key) keys.push(object.Key);
			}
			return { keys, next: page.IsTruncated ? page.NextContinuationToken : undefined };
		},
		async remove(bucket, keys) {
			const result = await client.send(
				new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: false } })
			);
			return {
				deleted: result.Deleted?.length ?? 0,
				errors: (result.Errors ?? []).map((error) => `${error.Code ?? "Error"}: ${error.Message ?? "unknown"}`)
			};
		}
	};
}

async function main() {
	const plan = planClean(process.env);
	if (plan.action === "skip") {
		console.log(`Skipping the dev R2 cleanup: ${plan.reason}`);
		return;
	}
	if (plan.action === "refuse") {
		console.error(`Refusing to empty the R2 bucket: ${plan.reason}`);
		process.exitCode = 1;
		return;
	}

	try {
		const deleted = await emptyBucket(s3Ops(plan), plan.bucket);
		console.log(`Deleted ${deleted} object(s) from the dev R2 bucket "${plan.bucket}".`);
	} catch (cause) {
		console.error(`The dev R2 cleanup failed: ${cause instanceof Error ? cause.message : String(cause)}`);
		process.exitCode = 1;
	}
}

if (import.meta.main) await main();
