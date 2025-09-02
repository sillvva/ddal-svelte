import { BLANK_CHARACTER } from "$lib/constants.js";
import { characterIdSchema } from "$lib/schemas.js";
import { type ErrorParams } from "$lib/server/effect/errors";
import { run } from "$lib/server/effect/runtime.js";
import { CharacterService } from "$lib/server/effect/services/characters";
import { Resvg } from "@resvg/resvg-js";
import { error, type NumericRange } from "@sveltejs/kit";
import { Data } from "effect";
import { readFile } from "fs/promises";
import path from "path";
import satori from "satori";
import sharp from "sharp";
import { safeParse } from "valibot";

class UnableToFetchImageError extends Data.TaggedError("UnableToFetchImageError")<ErrorParams> {
	constructor(params: ErrorParams = { message: "Unable to fetch image", status: 500 }) {
		super(params);
	}
}

export const GET = async ({ params, url }) => {
	const result = safeParse(characterIdSchema, params.characterId);
	if (!result.success) throw error(404, "Character not found");
	const characterId = result.output;

	const character = await run(function* () {
		const Characters = yield* CharacterService;
		return yield* Characters.get.character(characterId, true);
	});

	const width = 600;
	const height = 315;

	const imageContainerWidth = 198;
	const imageContainerHeight = 270;

	const draconis = await readFile(path.resolve("static/fonts/Draconis.ttf"));
	const vecna = await readFile(path.resolve("static/fonts/Vecna.ttf"));
	const vecnaBold = await readFile(path.resolve("static/fonts/VecnaBold.ttf"));
	const roboto = await readFile(path.resolve("static/fonts/Roboto-Regular.ttf"));

	const fallbackImageUrl = `${url.origin}${BLANK_CHARACTER}`;
	let imageUrl =
		!character.imageUrl || character.imageUrl.includes(".webp")
			? fallbackImageUrl
			: character.imageUrl.startsWith("http")
				? character.imageUrl
				: `${url.origin}${character.imageUrl}`;

	let response;
	try {
		response = await fetch(imageUrl, { method: "GET" });
		if (!response.ok)
			throw new UnableToFetchImageError({ message: response.statusText, status: response.status as NumericRange<300, 599> });
	} catch {
		imageUrl = fallbackImageUrl;
		response = await fetch(fallbackImageUrl, { method: "GET" });
	}

	const svg = await satori(
		{
			type: "div",
			props: {
				style: {
					display: "flex",
					width: `${width}px`,
					height: `${height}px`,
					backgroundImage: `url(${url.origin}/images/barovia-gate.jpg)`,
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
													style: { fontSize: "18px", marginBottom: "6px", fontFamily: "Roboto" },
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
								width: 370
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
											color: "#bbb",
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
														fontFamily: "Roboto",
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
			fonts: [
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
					name: "Roboto",
					data: roboto,
					weight: 400,
					style: "normal"
				}
			]
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
