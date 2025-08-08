<script lang="ts">
	import type { Snippet } from "svelte";
	import { twMerge, type ClassNameValue } from "tailwind-merge";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, unknown> & { class?: ClassNameValue };
	}

	const { children, attributes }: Props = $props();
</script>

<details {...attributes} class={twMerge("my-2 border-l-4 border-gray-500/60 pl-3", attributes?.class)}>
	{@render children?.()}
</details>
