<script lang="ts">
	import { encode } from "uqr";

	interface Props {
		value: string;
	}

	let { value }: Props = $props();

	const code = $derived(encode(value, { ecc: "M", border: 2 }));
</script>

<svg viewBox="0 0 {code.size} {code.size}" class="size-44 bg-white" role="img" aria-label="QR code">
	{#each code.data as row, y (y)}
		{#each row as cell, x (x)}
			{#if cell}
				<rect {x} {y} width="1" height="1" fill="#000" />
			{/if}
		{/each}
	{/each}
</svg>
