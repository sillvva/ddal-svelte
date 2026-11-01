<script lang="ts">
	import { page } from "$app/state";
	import * as API from "#lib/remote/index.js";

	const { user } = $derived(await API.app.queries.request());
</script>

<nav class="dock sticky z-16 border-t border-base-content/10 bg-base-100/50 backdrop-blur-sm md:hidden print:hidden">
	<a href="/characters" class={[page.url.pathname.startsWith("/characters") && "dock-active"]}>
		<span class="iconify size-6 mdi--account-circle"></span>
		<span class="dock-label uppercase">Characters</span>
	</a>
	<a
		href="/dm-logs"
		class={[
			"flex h-full flex-col items-center justify-center text-xs",
			page.url.pathname.startsWith("/dm-logs") && "dock-active"
		]}
	>
		<span class="iconify size-6 mdi--notebook-favorite"></span>
		<span class="dock-label uppercase">DM Logs</span>
	</a>
	<a
		href="/dms"
		class={["flex h-full flex-col items-center justify-center text-xs", page.url.pathname.startsWith("/dms") && "dock-active"]}
	>
		<span class="iconify size-6 mdi--account-group"></span>
		<span class="dock-label uppercase">DMs</span>
	</a>
	{#if user?.role === "admin"}
		<a
			href="/admin/users"
			class={[
				"flex h-full flex-col items-center justify-center text-xs",
				page.url.pathname.startsWith("/admin") && "dock-active"
			]}
		>
			<span class="iconify size-6 mdi--administrator-outline"></span>
			<span class="dock-label uppercase">Admin</span>
		</a>
	{/if}
</nav>
