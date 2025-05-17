<script lang="ts">
	import type { Snippet } from "svelte";

	let { children }: { children?: Snippet } = $props();
</script>

<blockquote class="my-2 border-l-4 border-gray-500/60 pl-3">{@render children?.()}</blockquote>
