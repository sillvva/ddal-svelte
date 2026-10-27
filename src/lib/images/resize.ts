import { AVATAR_IMAGE_LIMITS, CHARACTER_IMAGE_LIMITS, formatBytes, type StoredImageContentType } from "#lib/images/limits.js";

export interface ResizedImage {
	blob: Blob;
	contentType: StoredImageContentType;
}

export interface ResizeImageLimits {
	maxOriginalBytes: number;
	maxStoredBytes: number;
	maxEdgePx: number;
	maxPixels: number;
	acceptedInputTypes: readonly string[];
}

/** `contain` scales the longest edge. `cover` center-crops a square, then scales that edge. */
export type ResizeFit = "contain" | "cover";

function encode(canvas: HTMLCanvasElement, type: StoredImageContentType, quality: number) {
	return new Promise<Blob | null>((resolve) => {
		canvas.toBlob((blob) => resolve(blob), type, quality);
	});
}

function drawContain(bitmap: ImageBitmap, maxEdgePx: number) {
	const scale = Math.min(1, maxEdgePx / Math.max(bitmap.width, bitmap.height));
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) return null;
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";
	context.drawImage(bitmap, 0, 0, width, height);
	return canvas;
}

function drawCover(bitmap: ImageBitmap, maxEdgePx: number) {
	const crop = Math.min(bitmap.width, bitmap.height);
	const side = Math.max(1, Math.min(maxEdgePx, crop));
	const sx = Math.floor((bitmap.width - crop) / 2);
	const sy = Math.floor((bitmap.height - crop) / 2);
	const canvas = document.createElement("canvas");
	canvas.width = side;
	canvas.height = side;
	const context = canvas.getContext("2d");
	if (!context) return null;
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";
	context.drawImage(bitmap, sx, sy, crop, crop, 0, 0, side, side);
	return canvas;
}

/**
 * Scales an image in the browser so the bytes sent to R2 are already within the stored-size limit.
 * The original file is not uploaded.
 */
export async function resizeImage(file: File, limits: ResizeImageLimits, fit: ResizeFit): Promise<ResizedImage> {
	const accepted: readonly string[] = limits.acceptedInputTypes;
	const fileType = file.type === "image/jpg" ? "image/jpeg" : file.type;
	if (fileType && !accepted.includes(fileType)) {
		throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
	}
	if (file.size > limits.maxOriginalBytes) {
		throw new Error(`That image is larger than ${formatBytes(limits.maxOriginalBytes)}.`);
	}

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
	} catch {
		throw new Error("That file could not be read as an image.");
	}

	try {
		if (bitmap.width * bitmap.height > limits.maxPixels) {
			throw new Error("That image is too large to resize in the browser.");
		}

		const canvas = fit === "cover" ? drawCover(bitmap, limits.maxEdgePx) : drawContain(bitmap, limits.maxEdgePx);
		if (!canvas) throw new Error("Could not resize that image.");

		const webp = await encode(canvas, "image/webp", 0.86);
		const contentType: StoredImageContentType = webp && webp.type === "image/webp" ? "image/webp" : "image/jpeg";
		const qualities = [0.86, 0.72, 0.58];
		for (const quality of qualities) {
			const blob = contentType === "image/webp" && quality === 0.86 && webp ? webp : await encode(canvas, contentType, quality);
			if (blob && blob.size > 0 && blob.size <= limits.maxStoredBytes) {
				return { blob, contentType };
			}
		}

		throw new Error("That image is still too large after resizing.");
	} finally {
		bitmap.close();
	}
}

/** Portrait resize: longest edge at most 800px, original aspect ratio kept. */
export function resizeCharacterImage(file: File) {
	return resizeImage(file, CHARACTER_IMAGE_LIMITS, "contain");
}

/** Avatar resize: center square, longest edge at most 256px. */
export function resizeAvatarImage(file: File) {
	return resizeImage(file, AVATAR_IMAGE_LIMITS, "cover");
}
