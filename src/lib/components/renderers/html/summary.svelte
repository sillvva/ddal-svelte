<script lang="ts">
	import type { Snippet } from "svelte";
	import { twMerge, type ClassNameValue } from "tailwind-merge";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, unknown> & { class?: ClassNameValue };
	}

	const { children, attributes }: Props = $props();
</script>

<summary {...attributes} class={twMerge("mt-4 mb-1 cursor-pointer text-xl font-semibold first:mt-0", attributes?.class)}>
	{@render children?.()}
</summary>
