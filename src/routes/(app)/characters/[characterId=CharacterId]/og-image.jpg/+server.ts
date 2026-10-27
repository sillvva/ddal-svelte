import { BLANK_CHARACTER } from "#lib/constants.js";
import { characterIdSchema } from "#lib/schemas.js";
import { fetchPublic } from "#lib/server/effect/util.js";
import { run } from "#lib/server/effect/runtime.js";
import { CharacterService } from "#lib/server/effect/services/characters.js";
import { Resvg } from "@resvg/resvg-js";
import { error } from "@sveltejs/kit";
import { readFile } from "fs/promises";
import path from "path";
import satori, { type Font } from "satori";
import sharp from "sharp";
import { safeParse } from "valibot";

const staticRoot = path.resolve("static");

function imageDataUri(bytes: Buffer, mime = "image/jpeg") {
	return `data:${mime};base64,${bytes.toString("base64")}`;
}

function mimeForImage(filename: string) {
	switch (path.extname(filename).toLowerCase()) {
		case ".png":
			return "image/png";
		case ".gif":
			return "image/gif";
		case ".webp":
			return "image/webp";
		case ".svg":
			return "image/svg+xml";
		default:
			return "image/jpeg";
	}
}

async function readStaticImage(pathname: string) {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}

	const filePath = path.resolve(staticRoot, decoded.replace(/^\/+/, ""));
	if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${path.sep}`)) return null;

	try {
		return imageDataUri(await readFile(filePath), mimeForImage(filePath));
	} catch {
		return null;
	}
}

async function readLimited(response: Response, maxBytes: number) {
	const declared = Number(response.headers.get("content-length") ?? "0");
	if (Number.isFinite(declared) && declared > maxBytes) {
		await response.body?.cancel().catch(() => undefined);
		return null;
	}

	if (!response.body) {
		const bytes = Buffer.from(await response.arrayBuffer());
		return bytes.byteLength > maxBytes ? null : bytes;
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel().catch(() => undefined);
			return null;
		}
		chunks.push(value);
	}

	return Buffer.concat(chunks);
}

function isLocalImage(imageUrl: string, origin: string) {
	if (imageUrl.startsWith("/")) return true;

	try {
		const parsed = new URL(imageUrl);
		const originUrl = new URL(origin);
		return (
			parsed.host === originUrl.host ||
			parsed.hostname === "localhost" ||
			parsed.hostname === "127.0.0.1" ||
			parsed.hostname === "::1"
		);
	} catch {
		return false;
	}
}

async function resolvePortrait(imageUrl: string, origin: string) {
	if (!imageUrl || imageUrl === BLANK_CHARACTER) return blankCharacter;

	if (isLocalImage(imageUrl, origin)) {
		const pathname = imageUrl.startsWith("/") ? imageUrl : new URL(imageUrl).pathname;
		return (await readStaticImage(pathname)) ?? blankCharacter;
	}

	try {
		const response = await fetchPublic(imageUrl, "GET");
		if (!response?.ok) return blankCharacter;

		const headerMime = response.headers.get("content-type")?.split(";")[0]?.trim();
		const mime = headerMime === "image/jpg" ? "image/jpeg" : headerMime || mimeForImage(new URL(imageUrl).pathname);
		if (!mime.startsWith("image/") || mime === "image/svg+xml") {
			await response.body?.cancel().catch(() => undefined);
			return blankCharacter;
		}

		const bytes = await readLimited(response, 8 * 1024 * 1024);
		if (!bytes) return blankCharacter;
		if (mime === "image/webp") {
			const jpeg = await sharp(bytes).jpeg({ quality: 85 }).toBuffer();
			return imageDataUri(jpeg, "image/jpeg");
		}

		return imageDataUri(bytes, mime);
	} catch {
		return blankCharacter;
	}
}

const [draconis, vecna, vecnaBold, inter, baroviaGateBytes, blankCharacterBytes] = await Promise.all([
	readFile(path.resolve("static/fonts/Draconis.ttf")),
	readFile(path.resolve("static/fonts/Vecna.ttf")),
	readFile(path.resolve("static/fonts/VecnaBold.ttf")),
	readFile(path.resolve("static/fonts/Inter.ttf")),
	readFile(path.resolve("static/images/barovia-gate.jpg")),
	readFile(path.resolve("static/images/blank-character.jpg"))
]);

const baroviaGate = imageDataUri(baroviaGateBytes);
const blankCharacter = imageDataUri(blankCharacterBytes);

const fonts: Font[] = [
	{
		name: "Vecna",
		data: vecna,
		weight: 400,
		style: "normal"
	},
	{
		name: "VecnaBold",
		data: vecnaBold,
		weight: 700,
		style: "normal"
	},
	{
		name: "Draconis",
		data: draconis,
		weight: 400,
		style: "normal"
	},
	{
		name: "Inter",
		data: inter,
		weight: 600,
		style: "normal"
	}
];

export const GET = async ({ params, url }) => {
	const result = safeParse(characterIdSchema, params.characterId);
	if (!result.success) throw error(404, "Character not found");
	const characterId = result.output;

	const character = await run(function* () {
		const Characters = yield* CharacterService;
		return yield* Characters.get.one(characterId, true);
	});

	const width = 600;
	const height = 315;

	const imageContainerWidth = 198;
	const imageContainerHeight = 270;

	const imageUrl = await resolvePortrait(character.imageUrl, url.origin);

	const svg = await satori(
		{
			type: "div",
			props: {
				style: {
					display: "flex",
					width: `${width}px`,
					height: `${height}px`,
					backgroundImage: `url("${baroviaGate}")`,
					backgroundSize: "cover"
				},
				children: [
					{
						type: "div",
						props: {
							style: {
								display: "flex",
								backgroundColor: "#0008",
								width: `${width}px`,
								height: `${height}px`,
								color: "white",
								textShadow: "2px 2px 4px #000000"
							},
							children: [
								{
									type: "div",
									props: {
										style: {
											flex: 1,
											display: "flex",
											flexDirection: "column",
											justifyContent: "center",
											padding: "30px"
										},
										children: [
											{
												type: "h1",
												props: {
													style: {
														fontSize: "32px",
														fontWeight: "bold",
														paddingBottom: "5px",
														borderBottom: "1px solid #fff4",
														marginBottom: "5px",
														fontFamily: "VecnaBold"
													},
													children: character.name
												}
											},
											{
												type: "div",
												props: {
													style: { fontSize: "18px", marginBottom: "6px", fontFamily: "Inter" },
													children: `${character.race} ${character.class}`.replace(/ {2,}/g, " ").trim()
												}
											}
										]
									}
								},
								imageUrl && {
									type: "img",
									props: {
										src: imageUrl,
										style: {
											width: imageContainerWidth,
											height: imageContainerHeight,
											borderRadius: "12px",
											margin: "24px",
											marginLeft: 0,
											boxShadow: "0 0 32px #000a",
											backgroundColor: "#000a",
											objectFit: "cover",
											objectPosition: "center top"
										}
									}
								}
							].filter(Boolean)
						}
					},
					{
						type: "div",
						props: {
							style: {
								display: "flex",
								position: "absolute",
								top: "8px",
								left: "8px",
								padding: "18px 24px",
								lineHeight: "0.8",
								width: width - imageContainerWidth - 72
							},
							children: [
								{
									type: "div",
									props: {
										style: {
											display: "flex",
											flexDirection: "column",
											justifyContent: "center",
											fontFamily: "Draconis",
											color: "#ccc",
											flex: 1
										},
										children: [
											{
												type: "div",
												props: {
													style: {
														fontSize: "16px"
													},
													children: "Adventurers League"
												}
											},
											{
												type: "div",
												props: {
													style: {
														fontSize: "33px"
													},
													children: "Log Sheet"
												}
											}
										]
									}
								},
								{
									type: "div",
									props: {
										style: {
											display: "flex",
											flexDirection: "column",
											alignItems: "center",
											justifyContent: "center",
											color: "#fff",
											paddingLeft: 5,
											backgroundColor: "#0008",
											width: 50,
											height: 50,
											borderRadius: "100%",
											boxShadow: "4px 4px 8px #000a"
										},
										children: [
											{
												type: "div",
												props: {
													style: {
														display: "flex",
														fontFamily: "Inter",
														fontSize: "10px"
													},
													children: "LEVEL"
												}
											},
											{
												type: "div",
												props: {
													style: {
														display: "flex",
														fontFamily: "VecnaBold",
														fontSize: "32px"
													},
													children: character.totalLevel
												}
											}
										]
									}
								}
							]
						}
					}
				]
			}
		},
		{
			width,
			height,
			fonts
		}
	);

	const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
	const png = resvg.render();
	const buffer = await sharp(png.asPng()).jpeg({ quality: 80 }).toBuffer();

	return new Response(new Uint8Array(buffer), {
		headers: {
			"Content-Type": "image/jpeg",
			"Cache-Control": "public, max-age=21600"
		}
	});
};
