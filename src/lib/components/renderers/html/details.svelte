<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, unknown>;
	}

	const { children, attributes }: Props = $props();
</script>

<details {...attributes} class="my-2 border-l-4 border-gray-500/60 pl-3">
	{@render children?.()}
</details>
