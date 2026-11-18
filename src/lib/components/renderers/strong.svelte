<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
	}
	const { children }: Props = $props();
</script>

<strong class="text-base-content/50">{@render children?.()}</strong>
