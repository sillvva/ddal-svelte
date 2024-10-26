<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		href?: string;
		title?: string | null;
		children?: Snippet;
	}

	let { href = "", title = undefined, children }: Props = $props();
</script>

<a {href} {title} class="text-secondary">{@render children?.()}</a>
