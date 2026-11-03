<script lang="ts">
	import { encode } from "uqr";

	interface Props {
		value: string;
	}

	let { value }: Props = $props();

	const PIXEL_SIZE = 10;

	const src = $derived.by(() => {
		const code = encode(value, { ecc: "M", border: 2 });
		const size = code.size * PIXEL_SIZE;
		let path = "";
		code.data.forEach((row, y) =>
			row.forEach((cell, x) => {
				if (cell) path += `M${x * PIXEL_SIZE},${y * PIXEL_SIZE}h${PIXEL_SIZE}v${PIXEL_SIZE}h-${PIXEL_SIZE}z`;
			})
		);
		const svg =
			`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
			`<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	});
</script>

<img {src} alt="QR code" class="size-44" />
