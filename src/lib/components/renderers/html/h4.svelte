<script lang="ts">
	import type { Snippet } from "svelte";
	import { twMerge } from "tailwind-merge";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, any>;
	}

	const { children, attributes }: Props = $props();
</script>

<h4 {...attributes} class={twMerge("text-md mb-2 overflow-hidden text-ellipsis", attributes?.class)}>{@render children?.()}</h4>
