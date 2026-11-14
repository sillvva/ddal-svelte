<script lang="ts">
	import Link from "#lib/components/link.svelte";
	import { page } from "$app/state";

	let { children } = $props();
</script>

<div role="tablist" class="tabs-box tabs">
	<Link href="admin/users" role="tab" class={["tab", page.url.pathname.startsWith("/admin/users") && "tab-active"]}>Users</Link>
	<Link href="admin/logs" role="tab" class={["tab", page.url.pathname.startsWith("/admin/logs") && "tab-active"]}>Logs</Link>
</div>

{@render children()}
