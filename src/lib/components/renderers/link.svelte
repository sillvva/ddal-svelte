<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		href?: string;
		title?: string | null;
		children?: Snippet;
	}

	let { href = "", title = undefined, children }: Props = $props();
</script>

<a {href} {title} target="_blank" rel="noreferrer noopener" class="text-secondary">{@render children?.()}</a>

<style>
	a[target="_blank"]:not(:empty):not(:has(*:not(:global(span))))::after {
		content: "↗";
		margin-inline-start: 0.125rem;
		display: inline-block;
	}
</style>
