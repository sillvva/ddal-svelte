<script lang="ts">
	import type { Snippet } from "svelte";
	import { twMerge } from "tailwind-merge";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, any>;
	}

	const { children, attributes }: Props = $props();
</script>

<h1 {...attributes} class={twMerge("mt-6 mb-2 text-3xl font-bold first:mt-0", attributes?.class)}>{@render children?.()}</h1>
