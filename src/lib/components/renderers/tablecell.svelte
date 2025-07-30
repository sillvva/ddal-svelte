<script lang="ts">
	interface Props {
		header: boolean;
		children?: import("svelte").Snippet;
	}

	let { header, children }: Props = $props();
</script>

{#if header}
	<th class="align-bottom">{@render children?.()}</th>
{:else}
	<td class="align-top whitespace-normal">{@render children?.()}</td>
{/if}
