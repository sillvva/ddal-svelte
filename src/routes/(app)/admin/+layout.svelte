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

<svelte:boundary>
	{#snippet pending()}
		<div class="bg-base-200 flex h-40 flex-col items-center justify-center rounded-lg">
			<span class="loading loading-spinner text-secondary w-16"></span>
		</div>
	{/snippet}

	{#snippet failed(error)}
		<div class="alert alert-error mb-4 w-full max-w-3xl shadow-lg">
			<span class="iconify mdi--alert-circle size-6"></span>
			<div class="flex flex-col">
				<h3 class="font-bold">Error!</h3>
				<div class="text-xs whitespace-pre-line">{JSON.stringify(error)}</div>
			</div>
		</div>
	{/snippet}

	{@render children()}
</svelte:boundary>
