<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, unknown>;
	}

	const { children, attributes }: Props = $props();
</script>

<h1 {...attributes} class="mt-6 mb-2 text-3xl font-bold first:mt-0">{@render children?.()}</h1>
