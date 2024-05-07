<script lang="ts">
	export let header: boolean;
</script>

{#if header}
	<th class="align-bottom"><slot /></th>
{:else}
	<td class="align-top"><slot /></td>
{/if}
