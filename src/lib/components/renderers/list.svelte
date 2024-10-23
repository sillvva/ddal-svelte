<script lang="ts">
	interface Props {
		ordered: boolean;
		start: number;
		children?: import("svelte").Snippet;
	}

	let { ordered, start, children }: Props = $props();
</script>

{#if ordered}
	<ol class="ml-4 list-outside" {start}>{@render children?.()}</ol>
{:else}
	<ul class="ml-4 list-outside">{@render children?.()}</ul>
{/if}
