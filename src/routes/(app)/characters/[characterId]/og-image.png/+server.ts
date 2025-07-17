import { BLANK_CHARACTER } from "$lib/constants.js";
import { characterIdSchema } from "$lib/schemas.js";
import { run } from "$server/effect";
import { withCharacter } from "$server/effect/characters";
import { Resvg } from "@resvg/resvg-js";
import { error } from "@sveltejs/kit";
import { readFile } from "fs/promises";
import { imageSize } from "image-size";
import path from "path";
import satori from "satori";
import { parse } from "valibot";

export const GET = async ({ params, url }) => {
	const characterId = parse(characterIdSchema, params.characterId);
	const character = await run(withCharacter((service) => service.get.character(characterId, true)));
	if (!character) throw error(404, "Character not found");

	const width = 1200;
	const height = 630;

	const imageContainerWidth = 420;
	const imageContainerHeight = 540;

	const draconis = await readFile(path.resolve("static/fonts/Draconis.ttf"));
	const vecna = await readFile(path.resolve("static/fonts/Vecna.ttf"));
	const vecnaBold = await readFile(path.resolve("static/fonts/VecnaBold.ttf"));
	const fallbackImageUrl = `${url.origin}${BLANK_CHARACTER}`;
	let imageUrl = !character.imageUrl || character.imageUrl.includes(".webp") ? fallbackImageUrl : character.imageUrl;

	let response;
	try {
		if (imageUrl === fallbackImageUrl) throw new Error("Using fallback image.");
		response = await fetch(imageUrl, { method: "GET" });
		if (!response.ok) throw new Error("Image not found. Using fallback image.");
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
					backgroundSize: "cover",
					backgroundPosition: "center center"
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
													style: { fontSize: "40px", marginBottom: "12px" },
													children: `${character.race} ${character.class}`.replace(/ {2,}/g, " ").trim()
												}
											},
											{
												type: "div",
												props: {
													style: { fontSize: "28px", marginBottom: "12px" },
													children: `Level ${character.totalLevel}`
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
											margin: "60px",
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
								flexDirection: "column",
								justifyContent: "center",
								position: "absolute",
								top: "16px",
								left: "16px",
								padding: "36px 48px",
								fontSize: "60px",
								fontFamily: "Draconis",
								color: "#fffc"
							},
							children: [
								{
									type: "div",
									props: {
										children: "Adventurers League Log Sheet"
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
			"Cache-Control": "public, max-age=3600"
		}
	});
};
