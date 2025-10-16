<script lang="ts">
	import { getGlobal } from "$lib/stores.svelte";

	const global = getGlobal();
</script>

<nav class="bg-base-100/50 dock border-base-content/10 sticky z-16 border-t backdrop-blur-sm md:hidden print:hidden">
	<a href="/characters">
		<span class="iconify mdi--account-circle size-8"></span>
		<span class="dock-label uppercase">Characters</span>
	</a>
	<a href="/dm-logs" class="flex h-full flex-col items-center justify-center text-xs">
		<span class="iconify mdi--notebook-favorite size-8"></span>
		<span class="dock-label uppercase">DM Logs</span>
	</a>
	<a href="/dms" class="flex h-full flex-col items-center justify-center text-xs">
		<span class="iconify mdi--account-group size-8"></span>
		<span class="dock-label uppercase">DMs</span>
	</a>
	{#if global.user?.role === "admin"}
		<a href="/admin/users" class="flex h-full flex-col items-center justify-center text-xs">
			<span class="iconify mdi--administrator-outline size-8"></span>
			<span class="dock-label uppercase">Admin</span>
		</a>
	{/if}
</nav>
