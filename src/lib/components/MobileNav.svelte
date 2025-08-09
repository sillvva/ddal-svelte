<script lang="ts">
	import { getRequestDetails } from "$lib/remote/app.remote";

	const request = $derived(getRequestDetails());
	const user = $derived(request.current?.user);
</script>

<nav
	class="bg-base-100/50 border-base-content/10 sticky right-0 bottom-0 left-0 z-16 flex h-16 justify-evenly border-t backdrop-blur-sm *:w-20 md:hidden"
>
	<a href="/characters" class="flex h-full flex-col items-center justify-center text-xs">
		<span class="iconify mdi--account-circle size-8"></span>
		<span class="text-center uppercase">Characters</span>
	</a>
	<a href="/dm-logs" class="flex h-full flex-col items-center justify-center text-xs">
		<span class="iconify mdi--notebook-favorite size-8"></span>
		<span class="text-center uppercase">DM Logs</span>
	</a>
	<a href="/dms" class="flex h-full flex-col items-center justify-center text-xs">
		<span class="iconify mdi--account-group size-8"></span>
		<span class="text-center uppercase">DMs</span>
	</a>
	{#if user?.role === "admin"}
		<a href="/admin/users" class="flex h-full flex-col items-center justify-center text-xs">
			<span class="iconify mdi--administrator-outline size-8"></span>
			<span class="text-center uppercase">Admin</span>
		</a>
	{/if}
</nav>
