import type { ErrorParams } from "#lib/server/effect/errors.js";
import { Data } from "effect";

export class ImageUploadError extends Data.TaggedError("ImageUploadError")<ErrorParams> {
	constructor(message: string, status: ErrorParams["status"] = 400, cause?: unknown) {
		super({ message, status, cause });
	}
}
