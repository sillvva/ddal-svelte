<script type="ts">
	export let href = "";
</script>

{#if href}
	<li>
		<a {href} class="text-secondary">
			<slot />
		</a>
	</li>
{:else}
	<li class="overflow-hidden text-ellipsis whitespace-nowrap dark:drop-shadow-md">
		<slot />
	</li>
{/if}
