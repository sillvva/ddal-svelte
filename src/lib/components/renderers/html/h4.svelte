<script lang="ts">
	import type { Snippet } from "svelte";
	import { twMerge } from "tailwind-merge";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, any>;
	}

	const { children, attributes }: Props = $props();
</script>

<h4 {...attributes} class={twMerge("text-md ellipsis-nowrap mb-2", attributes?.class)}>{@render children?.()}</h4>
