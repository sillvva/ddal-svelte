<script lang="ts">
	import { twMerge } from "tailwind-merge";
	import { slugify } from "$src/lib/misc";
	export let depth: number;
	export let raw: any = "";
	export let text: string = "";

	let className = "";
	export { className as class };

	$: id = slugify(text);
</script>

{#if depth === 1}
	<h1 {id} class={twMerge("text-3xl font-bold", className)}>
		<slot />
	</h1>
{:else if depth === 2}
	<h2 {id} class={twMerge("text-2xl font-bold", className)}>
		<slot />
	</h2>
{:else if depth === 3}
	<h3 {id} class={twMerge("text-xl font-semibold", className)}>
		<slot />
	</h3>
{:else if depth === 4}
	<h4 {id} class={twMerge("text-md mb-2 overflow-hidden text-ellipsis", className)}>
		<slot />
	</h4>
{:else}
	{raw}
{/if}
