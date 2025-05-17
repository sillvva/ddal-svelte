<script lang="ts">
	import type { Snippet } from "svelte";
	import { twMerge } from "tailwind-merge";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, any>;
	}

	const { children, attributes }: Props = $props();
</script>

<details {...attributes} class={twMerge("my-2 border-l-4 border-gray-500/60 pl-3", attributes?.class)}>
	{@render children?.()}
</details>
