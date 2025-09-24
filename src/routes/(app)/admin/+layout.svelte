<script lang="ts">
	import { page } from "$app/state";

	let { children } = $props();
</script>

<div class="flex flex-col gap-4">
	<div role="tablist" class="tabs tabs-box">
		<a href="/admin/users" role="tab" class={["tab", page.url.pathname.startsWith("/admin/users") && "tab-active"]}>Users</a>
		<a href="/admin/logs" role="tab" class={["tab", page.url.pathname.startsWith("/admin/logs") && "tab-active"]}>Logs</a>
	</div>

	{@render children()}
</div>
