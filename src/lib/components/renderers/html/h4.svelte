<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, unknown>;
	}

	const { children, attributes }: Props = $props();
</script>

<h6 {...attributes} class="text-md mb-2 ellipsis-nowrap">{@render children?.()}</h6>
