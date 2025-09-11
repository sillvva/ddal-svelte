<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, unknown>;
	}

	const { children, attributes }: Props = $props();
</script>

<summary {...attributes} class="mt-4 mb-1 cursor-pointer text-xl font-semibold first:mt-0">
	{@render children?.()}
</summary>
