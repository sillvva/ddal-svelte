import { BLANK_CHARACTER } from "$lib/constants.js";
import { characterIdSchema } from "$lib/schemas.js";
import { run } from "$server/effect";
import { withCharacter } from "$server/effect/characters";
import { Resvg } from "@resvg/resvg-js";
import { error } from "@sveltejs/kit";
import { readFile } from "fs/promises";
import path from "path";
import satori from "satori";
import { parse } from "valibot";

export const GET = async ({ params, url }) => {
	const characterId = parse(characterIdSchema, params.characterId);
	const character = await run(withCharacter((service) => service.get.character(characterId, true)));
	if (!character) throw error(404, "Character not found");

	const width = 1200;
	const height = 630;

	const imageContainerWidth = 396;
	const imageContainerHeight = 540;

	const draconis = await readFile(path.resolve("static/fonts/Draconis.ttf"));
	const vecna = await readFile(path.resolve("static/fonts/Vecna.ttf"));
	const vecnaBold = await readFile(path.resolve("static/fonts/VecnaBold.ttf"));
	const fallbackImageUrl = `${url.origin}${BLANK_CHARACTER}`;
	let imageUrl =
		!character.imageUrl || character.imageUrl.includes(".webp")
			? fallbackImageUrl
			: character.imageUrl.startsWith("http")
				? character.imageUrl
				: `${url.origin}${character.imageUrl}`;

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
											borderRadius: "24px",
											margin: "48px",
											width: imageContainerWidth,
											height: imageContainerHeight,
											boxShadow: "0 0 32px #000a",
											backgroundColor: "#000a",
											overflow: "hidden"
										},
										children: [
											{
												type: "img",
												props: {
													src: imageUrl,
													width: 396,
													height: 540,
													style: {
														maxWidth: 396,
														maxHeight: 540,
														width: "100%",
														height: "100%",
														objectFit: "contain",
														objectPosition: "top"
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
								fontFamily: "Draconis",
								color: "#fffa",
								lineHeight: "0.8"
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
