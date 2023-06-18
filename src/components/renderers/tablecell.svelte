<script lang="ts">
	export let header: boolean;
</script>

{#if header}
	<th><slot /></th>
{:else}
	<td><slot /></td>
{/if}

<style>
	th {
		vertical-align: bottom;
	}
	td {
		vertical-align: top;
	}
</style>
