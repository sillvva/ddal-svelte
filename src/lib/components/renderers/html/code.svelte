<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, unknown>;
	}

	const { children, attributes }: Props = $props();
</script>

<code {...attributes}>{@render children?.()}</code>
