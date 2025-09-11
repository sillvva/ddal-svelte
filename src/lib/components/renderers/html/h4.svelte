<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, unknown>;
	}

	const { children, attributes }: Props = $props();
</script>

<h4 {...attributes} class="text-md ellipsis-nowrap mb-2">{@render children?.()}</h4>
