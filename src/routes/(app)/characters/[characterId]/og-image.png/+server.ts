import { BLANK_CHARACTER } from "$lib/constants.js";
import { characterIdSchema } from "$lib/schemas.js";
import { runOrThrow } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters";
import type { ErrorParams } from "$lib/types";
import { Resvg } from "@resvg/resvg-js";
import { error, type NumericRange } from "@sveltejs/kit";
import { Data } from "effect";
import { readFile } from "fs/promises";
import imageSize from "image-size";
import path from "path";
import satori from "satori";
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

	const character = await runOrThrow(withCharacter((service) => service.get.character(characterId, true)));
	if (!character) throw error(404, "Character not found");

	const width = 1200;
	const height = 630;

	const imageContainerWidth = 396;
	const imageContainerHeight = 540;

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
		if (imageUrl === fallbackImageUrl) {
			imageUrl = fallbackImageUrl;
			response = await fetch(fallbackImageUrl, { method: "GET" });
		} else {
			response = await fetch(imageUrl, { method: "GET" });
			if (!response.ok)
				throw new UnableToFetchImageError({ message: response.statusText, status: response.status as NumericRange<400, 599> });
		}
	} catch (e) {
		imageUrl = fallbackImageUrl;
		response = await fetch(fallbackImageUrl, { method: "GET" });
	}

	const arrayBuffer = await response.arrayBuffer();
	const imgBuffer = Buffer.from(arrayBuffer);
	const { width: imgWidth, height: imgHeight } = imageSize(imgBuffer);

	const imageRatio = imgWidth / imgHeight;
	const imageContainerRatio = imageContainerWidth / imageContainerHeight;

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
											padding: "60px"
										},
										children: [
											{
												type: "h1",
												props: {
													style: {
														fontSize: "64px",
														fontWeight: "bold",
														paddingBottom: "10px",
														borderBottom: "1px solid #fff4",
														marginBottom: "10px",
														fontFamily: "VecnaBold"
													},
													children: character.name
												}
											},
											{
												type: "div",
												props: {
													style: { fontSize: "36px", marginBottom: "12px", fontFamily: "Roboto" },
													children: `${character.race} ${character.class}`.replace(/ {2,}/g, " ").trim()
												}
											}
										]
									}
								},
								imageUrl && {
									type: "div",
									props: {
										style: {
											display: "flex",
											width: imageContainerWidth,
											height: imageContainerHeight,
											borderRadius: "24px",
											margin: "48px",
											marginLeft: 0,
											boxShadow: "0 0 32px #000a",
											backgroundColor: "#000a",
											overflow: "hidden",
											position: "relative"
										},
										children: [
											{
												type: "img",
												props: {
													src: imageUrl,
													style: {
														position: "absolute",
														top: 0,
														left: "50%",
														transform: "translateX(-50%)",
														...(imageRatio > imageContainerRatio
															? {
																	height: "100%"
																}
															: {
																	width: "100%"
																})
													}
												}
											}
										]
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
								top: "16px",
								left: "16px",
								padding: "36px 48px",
								lineHeight: "0.8",
								width: 740
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
											color: "#fffa",
											flex: 1
										},
										children: [
											{
												type: "div",
												props: {
													style: {
														fontSize: "29px"
													},
													children: "Adventurers League"
												}
											},
											{
												type: "div",
												props: {
													style: {
														fontSize: "60px"
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
											width: 90,
											height: 90,
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
														fontSize: "16px"
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
														fontSize: "56px"
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
	const pngBuffer = png.asPng();

	return new Response(pngBuffer, {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=21600"
		}
	});
};
