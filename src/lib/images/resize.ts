import { CHARACTER_IMAGE_LIMITS, formatBytes, type StoredImageContentType } from "#lib/images/limits.js";

export interface ResizedCharacterImage {
	blob: Blob;
	contentType: StoredImageContentType;
}

function encode(canvas: HTMLCanvasElement, type: StoredImageContentType, quality: number) {
	return new Promise<Blob | null>((resolve) => {
		canvas.toBlob((blob) => resolve(blob), type, quality);
	});
}

/**
 * Scales a portrait in the browser so the bytes sent to R2 are already within the stored-size limit.
 * The original file is not uploaded.
 */
export async function resizeCharacterImage(file: File): Promise<ResizedCharacterImage> {
	const accepted: readonly string[] = CHARACTER_IMAGE_LIMITS.acceptedInputTypes;
	const fileType = file.type === "image/jpg" ? "image/jpeg" : file.type;
	if (fileType && !accepted.includes(fileType)) {
		throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
	}
	if (file.size > CHARACTER_IMAGE_LIMITS.maxOriginalBytes) {
		throw new Error(`That image is larger than ${formatBytes(CHARACTER_IMAGE_LIMITS.maxOriginalBytes)}.`);
	}

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
	} catch {
		throw new Error("That file could not be read as an image.");
	}

	try {
		if (bitmap.width * bitmap.height > CHARACTER_IMAGE_LIMITS.maxPixels) {
			throw new Error("That image is too large to resize in the browser.");
		}

		const scale = Math.min(1, CHARACTER_IMAGE_LIMITS.maxEdgePx / Math.max(bitmap.width, bitmap.height));
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Could not resize that image.");
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = "high";
		context.drawImage(bitmap, 0, 0, width, height);

		const webp = await encode(canvas, "image/webp", 0.86);
		const contentType: StoredImageContentType = webp && webp.type === "image/webp" ? "image/webp" : "image/jpeg";
		const qualities = [0.86, 0.72, 0.58];
		for (const quality of qualities) {
			const blob = contentType === "image/webp" && quality === 0.86 && webp ? webp : await encode(canvas, contentType, quality);
			if (blob && blob.size > 0 && blob.size <= CHARACTER_IMAGE_LIMITS.maxStoredBytes) {
				return { blob, contentType };
			}
		}

		throw new Error("That image is still too large after resizing.");
	} finally {
		bitmap.close();
	}
}
