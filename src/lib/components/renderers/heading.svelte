<script lang="ts">
	import { slugify } from "$lib/util";
	import { twMerge } from "tailwind-merge";
	export let depth: number;
	export let raw: any = "";
	export let text: string = "";

	let className = "";
	export { className as class };

	$: id = slugify(text);
</script>

{#if depth === 1}
	<h1 {id} class={twMerge("mb-2 mt-6 text-3xl font-bold first:mt-0", className)}>
		<slot />
	</h1>
{:else if depth === 2}
	<h2 {id} class={twMerge("mb-2 mt-4 text-2xl font-bold first:mt-0", className)}>
		<slot />
	</h2>
{:else if depth === 3}
	<h3 {id} class={twMerge("mb-2 mt-4 text-xl font-semibold first:mt-0", className)}>
		<slot />
	</h3>
{:else if depth === 4}
	<h4 {id} class={twMerge("text-md mb-2 overflow-hidden text-ellipsis", className)}>
		<slot />
	</h4>
{:else}
	{raw}
{/if}
