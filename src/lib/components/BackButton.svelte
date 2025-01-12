<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		href: string;
		children?: Snippet;
	}

	let { href, children }: Props = $props();
</script>

<a {href} class="mb-4 flex h-12 flex-1 items-center gap-4 text-secondary sm:hidden print:hidden" role="button" aria-label="Back">
	<span class="iconify size-6 mdi--chevron-left"></span>
	<span>Back to {@render children?.()}</span>
</a>
