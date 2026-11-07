import type { ErrorParams } from "#lib/server/effect/errors.js";
import { Data } from "effect";

export class ImageUploadError extends Data.TaggedError("ImageUploadError")<ErrorParams> {
	constructor(message: string, status: ErrorParams["status"] = 400, cause?: unknown) {
		super({ message, status, cause });
	}

	/** A staged upload that can't be saved. `reason` names the cause and should be a sentence ending in a period. */
	static reupload(reason: string, cause?: unknown) {
		return new ImageUploadError(`${reason} Upload that image again before saving.`, 400, cause);
	}
}
