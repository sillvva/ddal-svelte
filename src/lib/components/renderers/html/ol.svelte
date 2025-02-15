<script lang="ts">
	import type { Snippet } from "svelte";
	import { twMerge } from "tailwind-merge";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, any>;
	}

	const { children, attributes }: Props = $props();
</script>

<ol {...attributes} class={twMerge("mb-2 ml-4 list-outside [&>li]:list-decimal", attributes?.class)}>{@render children?.()}</ol>
