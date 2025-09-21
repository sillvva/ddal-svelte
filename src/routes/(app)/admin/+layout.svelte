<script lang="ts">
	import { page } from "$app/state";

	let { children } = $props();
</script>

<div class="flex flex-col gap-4">
	<div role="tablist" class="tabs tabs-box">
		<a href="/admin/users" role="tab" class={["tab", page.url.pathname.startsWith("/admin/users") && "tab-active"]}>Users</a>
		<a href="/admin/logs" role="tab" class={["tab", page.url.pathname.startsWith("/admin/logs") && "tab-active"]}>Logs</a>
	</div>

	<svelte:boundary>
		{#snippet pending()}
			<div class="bg-base-200 flex h-40 flex-col items-center justify-center rounded-lg">
				<span class="loading loading-spinner text-secondary-content w-16"></span>
			</div>
		{/snippet}

		{@render children()}
	</svelte:boundary>
</div>
