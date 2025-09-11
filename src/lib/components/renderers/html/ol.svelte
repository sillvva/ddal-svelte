<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, unknown>;
	}

	const { children, attributes }: Props = $props();
</script>

<ol {...attributes} class="mb-2 ml-4 list-outside [&>li]:list-decimal">{@render children?.()}</ol>
