<script lang="ts">
	import { page } from "$app/state";
	import { twMerge } from "tailwind-merge";

	let { children } = $props();
</script>

<div role="tablist" class="tabs tabs-border mb-4">
	<a href="/admin/users" role="tab" class={twMerge("tab", page.url.pathname.startsWith("/admin/users") && "tab-active")}>
		Users
	</a>
	<a href="/admin/logs" role="tab" class={twMerge("tab", page.url.pathname.startsWith("/admin/logs") && "tab-active")}>Logs</a>
</div>

{@render children()}
