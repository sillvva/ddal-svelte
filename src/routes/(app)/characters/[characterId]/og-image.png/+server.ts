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
	const character = await run(withCharacter((service) => service.get.character(characterId, false)));
	if (!character) throw error(404, "Character not found");

	const width = 1200;
	const height = 630;

	const fontData = await readFile(path.resolve("static/fonts/VecnaBold.ttf"));
	const imageUrl =
		!character.imageUrl || character.imageUrl == BLANK_CHARACTER || character.imageUrl.includes(".webp")
			? `${url.origin}${BLANK_CHARACTER.replace("webp", "jpg")}`
			: character.imageUrl;

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
								textShadow: "2px 2px 4px #000000",
								fontFamily: "VecnaBold"
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
														marginBottom: "10px"
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
									type: "img",
									props: {
										src: imageUrl,
										width: 420,
										height: 540,
										style: {
											objectFit: "cover",
											borderRadius: "24px",
											margin: "60px",
											boxShadow: "0 0 32px #000a",
											backgroundColor: "#000a"
										}
									}
								}
							].filter(Boolean)
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
					name: "VecnaBold",
					data: fontData,
					weight: 700,
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
