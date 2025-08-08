<script lang="ts">
	import type { Snippet } from "svelte";
	import { twMerge, type ClassNameValue } from "tailwind-merge";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, unknown> & { class?: ClassNameValue };
	}

	const { children, attributes }: Props = $props();
</script>

<ol {...attributes} class={twMerge("mb-2 ml-4 list-outside [&>li]:list-decimal", attributes?.class)}>{@render children?.()}</ol>
