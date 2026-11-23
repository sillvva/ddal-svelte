<script lang="ts">
	import * as API from "#lib/remote/index.js";
	import { page } from "$app/state";
	import AdminMenu from "./admin-menu.svelte";
	import Link from "./link.svelte";

	const { user } = $derived(await API.app.queries.request());
</script>

<nav class="dock sticky z-16 border-t border-base-content/10 bg-base-100/50 backdrop-blur-sm md:hidden print:hidden">
	<Link href="characters" class={[page.url.pathname.startsWith("/characters") && "dock-active"]}>
		<span class="iconify size-6 mdi--account-circle"></span>
		<span class="dock-label uppercase">Characters</span>
	</Link>
	<Link
		href="dm-logs"
		class={[
			"flex h-full flex-col items-center justify-center text-xs",
			page.url.pathname.startsWith("/dm-logs") && "dock-active"
		]}
	>
		<span class="iconify size-6 mdi--notebook-favorite"></span>
		<span class="dock-label uppercase">DM Logs</span>
	</Link>
	<Link
		href="dms"
		class={["flex h-full flex-col items-center justify-center text-xs", page.url.pathname.startsWith("/dms") && "dock-active"]}
	>
		<span class="iconify size-6 mdi--account-group"></span>
		<span class="dock-label uppercase">DMs</span>
	</Link>
	<Link
		href="drafts"
		class={["flex h-full flex-col items-center justify-center text-xs", page.url.pathname.startsWith("/drafts") && "dock-active"]}
	>
		<span class="iconify size-6 mdi--file-document-edit"></span>
		<span class="dock-label uppercase">Drafts</span>
	</Link>
	{#if user?.role === "admin"}
		<AdminMenu
			id="admin-menu-mobile"
			placement="top"
			class={[
				"flex h-full flex-col items-center justify-center text-xs",
				page.url.pathname.startsWith("/admin") && "dock-active"
			]}
		>
			<span class="iconify size-6 mdi--administrator-outline"></span>
			<span class="dock-label uppercase">Admin</span>
		</AdminMenu>
	{/if}
</nav>
