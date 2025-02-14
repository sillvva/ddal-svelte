<script lang="ts">
	interface Props {
		ordered: boolean;
		start: number;
		children?: import("svelte").Snippet;
	}

	let { ordered, start, children }: Props = $props();
</script>

{#if ordered}
	<ol class="mb-2 ml-4 list-outside [&>li]:list-decimal" {start}>{@render children?.()}</ol>
{:else}
	<ul class="mb-2 ml-4 list-outside [&>li]:list-disc">{@render children?.()}</ul>
{/if}
