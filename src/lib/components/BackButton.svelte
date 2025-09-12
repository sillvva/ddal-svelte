<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		href: string;
		children?: Snippet;
	}

	let { href, children }: Props = $props();
</script>

<a {href} class="text-secondary-content touch-hitbox flex items-center gap-4 print:hidden" role="button" aria-label="Back">
	<span class="iconify mdi--chevron-left size-6"></span>
	<span>Back to {@render children?.()}</span>
</a>
