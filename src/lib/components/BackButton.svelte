<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		href: string;
		children?: Snippet;
	}

	let { href, children }: Props = $props();
</script>

<a {href} class="text-secondary mb-4 flex h-8 flex-1 items-center gap-4 sm:hidden print:hidden" role="button" aria-label="Back">
	<span class="iconify mdi--chevron-left size-6"></span>
	<span>Back to {@render children?.()}</span>
</a>
